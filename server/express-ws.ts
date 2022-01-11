import expressWs from "express-ws";
import {
  Peer_,
  isPropPresent,
  getuuid,
  isNotNil,
  getPeerListMsg,
} from "./utils";
import { IncomingHttpHeaders, IncomingMessage } from "http";
import {
  assoc,
  both,
  complement,
  compose,
  curry,
  dissoc,
  flip,
  gt,
  identity,
  ifElse,
  isNil,
  not,
  or,
  path,
  prop,
  tryCatch,
  __,
} from "ramda";
import { Peer, Room, ServerState } from "./types";
const express = require("express");
const expressWebSocket = require("express-ws");
const websocketStream = require("websocket-stream/stream");
const app = express();

// extend express app with app.ws()
let expressWsInstance: expressWs.Instance = expressWebSocket(app, null, {
  // ws options here
  perMessageDeflate: false,
});

expressWsInstance
  .getWss()
  .on("connection", function (ws: any, req: IncomingMessage) {
    console.log("connection open");
  });

let rooms: ServerState = {};

app.ws("/", function (ws: any, req: any) {
  // Add peerId to incoming request
  req["peerId"] = getuuid();
  // convert ws instance to stream
  const stream = websocketStream(ws, {
    // websocket-stream options
    protocol: "string",
  });

  // Create a new Peer util object on each new connection
  let peer = Peer_(req, stream);
  let peerIp: string = peer.operations.getIp();
  let peerId = peer.operations.getPeerId();

  // Assign a room to the peer, and return new state
  rooms = joinRoom(rooms, peer, peerIp, peerId);

  // Notify other peers in the room that a new peer has joined
  let peersInRoomObj: Room = rooms[peerIp];

  // send this msg to all peers in the room --> room is an obj with peerId as key and peer as value
  let msgBody = getPeerListMsg(peersInRoomObj);
  Object.values(peersInRoomObj).forEach((peer) =>
    sendMessage(peer, msgBody, ws)
  );

  // bind message event handler to peer
  peer.state.stream.socket.on("message", (data: any) => {
    console.log(data, "Message");
    onMessage(data, peer, ws);
  });

  keepAlive(peer, ws);

  // print any incoming messages to the console
  stream.pipe(process.stdout);
});

app.listen(3000);

const GetPeerId = (request: any, headers: IncomingHttpHeaders) => {
  const getPeerIdIndex = (headers: any) => headers.cookie?.indexOf("peerid=");
  const doesPeerIdExistInCookie = compose(gt(__, -1), getPeerIdIndex);
  const doesResponseHeadersHaveCookieWithPeerId = both(
    isPropPresent("cookie"),
    doesPeerIdExistInCookie
  );
  const peerIdExists: any = compose(
    doesResponseHeadersHaveCookieWithPeerId,
    prop("headers")
  );

  let getPeerId = () => getuuid();

  let peerId: any = ifElse(complement(peerIdExists), getPeerId, () => {});

  return peerId(request);
};

const joinRoom = (
  currentState: ServerState,
  peer: Peer,
  peerIp: string,
  peerId: string
): any => {
  // Check if a room with the peer's IP exists
  const doesRoomExist = compose(isNotNil, prop(peerIp));
  // If room does not exist, create a new room
  let newState: any = ifElse(
    doesRoomExist,
    identity,
    assoc(peerIp, {})
  )(currentState);
  // add peer to the room
  newState[peerIp][peerId] = peer;

  // return new server state
  return newState;
};

const sendMessage = (peer: Peer, message: any, ws: any) => {
  if (!peer || ws.readyState !== ws.OPEN) return;
  let msg = JSON.stringify(message);
  peer.state.stream.write(msg);
};

const onMessage = (data: any, peer: Peer, ws: any) => {
  let JSONParser = tryCatch(JSON.parse, () =>
    console.log("Invalid Message", data)
  );
  let message: any = JSONParser(data);

  // messsage and message.type can be undefined
  if (message && message.type) {
    switch (message.type) {
      case "disconnect":
        kickPeerFromRoom(peer, ws);
        break;
      case "pong":
        peer.state.lastBeat = Date.now();
        break;
    }
  }
  let peerIp = peer.operations.getIp();
  let peerId = peer.operations.getPeerId();

  // carry forward message to other peers in the room
  if (message.to && rooms[peerIp]) {
    // reciver of the message
    let recipient = rooms[peerIp][message.to];

    // fn which remove to from message and add sender id to message
    let messageToRelayCreator = compose(dissocTo, assocSender(peerId));

    sendMessage(recipient, messageToRelayCreator(message), ws);
  }
};

const dissocTo = dissoc("to");
const assocSender = assoc("sender");

// implemented heart beat mechanism to keep connection alive
const keepAlive = (peer: Peer, ws: any) => {
  cancelPreviousKeepAliveTimer(peer);
  let timeout = 30000;

  let setLastBeat = (peer: Peer) => {
    peer.state.lastBeat = Date.now();
    return peer;
  };

  let assignPeerLastBeat = ifElse(
    compose(isNil, path(["state", "lastBeat"])),
    setLastBeat,
    identity
  );

  // if peer`s last beat is older than 60 seconds, kick him out
  let isLastBeatOlderThan60Sec = (peer: Peer) => {
    return Date.now() - peer.state.lastBeat > 2 * timeout;
  };

  let isPeerAlive = compose(not, isLastBeatOlderThan60Sec, assignPeerLastBeat);

  // if peer is not active, kick him out
  ifElse(isPeerAlive, identity, flip(kickPeerFromRoom)(ws))(peer);

  // send keep alive message to peer
  sendMessage(peer, { type: "ping" }, ws);

  // set timeout for next keep alive message
  peer.state.timerId = setTimeout(() => keepAlive(peer, ws), timeout);
};

const deleteRoom = (room: string) => dissoc(room, rooms);

const isRoomEmpty = (ip: string): boolean => {
  return Object.keys(rooms[ip]).length === 0;
};

const doesIpExistWithinRoom = (ip: any): boolean => isNil(prop(ip, rooms));
const doesPeerIdExistWithinRoom = (peerIp: any, peerId: any): boolean =>
  isNil(prop(peerId, prop(peerIp, rooms)));

const cancelPreviousKeepAliveTimer = (peer: Peer) => {
  let peerAndTimerIdPresent = both(
    isNotNil,
    compose(isPropPresent("timerId"), prop("state"))
  );
  if (peerAndTimerIdPresent(peer)) clearTimeout(peer.state.timerId);
};

const kickPeerFromRoom = curry((peer: Peer, ws: any) => {
  // verify if room exists and peer inside that room exists
  let peerIp: string = peer.operations.getIp();
  let peerId = peer.operations.getPeerId();

  // Option II - need a way when peerId is assigned, we use that, and same for ip
  // let roomExists = compose(isNotNil, prop(peer.state.ip));
  // let peerExists = compose(isNotNil, prop(peer.state.id));
  // let isPeerInRoom = both(roomExists, peerExists);

  let peerOrRoomNotPresent: boolean = or(
    doesIpExistWithinRoom(peerIp),
    doesPeerIdExistWithinRoom(peerIp, peerId)
  );

  if (!peerOrRoomNotPresent) {
    // Since peer is to be kicked out, remove any timers that are set
    cancelPreviousKeepAliveTimer(peer);
  }

  // remove peer from room
  rooms = dissoc(peerId, rooms[peerIp]);

  // close peer stream
  peer.state.stream.end();

  // if room is empty, delete room
  if (isRoomEmpty(peerIp)) {
    rooms = deleteRoom(peerIp);
  } else {
    //Notify peers in the room with updated list of peers
    let peersInRoomObj = rooms[peerIp];
    let msgBody = getPeerListMsg(peersInRoomObj);
    Object.values(peersInRoomObj).forEach((peer) =>
      sendMessage(peer, msgBody, ws)
    );
  }
});

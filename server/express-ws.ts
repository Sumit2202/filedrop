import expressWs from "express-ws";
import { Peer_, isPropPresent, getuuid, isNotNil } from "./utils";
import { IncomingHttpHeaders, IncomingMessage } from "http";
import {
  assoc,
  both,
  complement,
  compose,
  curry,
  gt,
  identity,
  ifElse,
  isNil,
  prop,
  __,
} from "ramda";
import { Message, MessageType, Peer, Room, ServerState } from "./types";
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

  // Get message body content
  let getMsg = compose(getMessage(__, "peer-list"), msgBody);

  // send this msg to all peers in the room
  Object.values(peersInRoomObj).forEach((peer) =>
    sendMessage(peer, getMsg(peersInRoomObj), ws)
  );

  // bind message event handler to peer
  stream.socket.on("message", (data: any) => {
    console.log(data, "Message");
    onMessage(data, peer);
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

const msgBody = (peers: Room): Message[] => {
  return Object.keys(peers).map((key) => ({
    id: key,
    name: peers[key].operations.getPeerName(),
    supportsRtc: peers[key].operations.isRtcCapable(),
  }));
};

const getMessage = curry(
  (body: any, type: string): MessageType => ({
    type,
    body,
  })
);

const onMessage = (data: any, peer: Peer) => {};

// implemented heart beat mechanism to keep connection alive
const keepAlive = (peer: Peer, ws: any) => {
  cancelPreviousKeepAliveTimer(peer);
  let timeout = 30000;

  let setLastBeat = (peer: Peer) => {
    peer.state.lastBeat = Date.now();
    return peer;
  };

  let assignPeerLastBeat = ifElse(isNil, setLastBeat, identity);

  // if peer`s last beat is older than 60 seconds, kick him out
  let isLastBeatOlderThan60Sec = (peer: Peer) => {
    return Date.now() - peer.state.lastBeat > 2 * timeout;
  };

  let isPeerAlive = compose(isLastBeatOlderThan60Sec, assignPeerLastBeat);

  // if peer is not active, kick him out
  ifElse(isPeerAlive, identity, kickPeerFromRoom)(peer);

  // send keep alive message to peer
  sendMessage(peer, { type: "ping" }, ws);

  // set timeout for next keep alive message
  peer.state.timerId = setTimeout(() => keepAlive(peer, ws), timeout);
};

const kickPeerFromRoom = (peer: Peer) => {
  // verify if room exists and peer inside that room exists

  // need a way when peerId is assigned, we use that, and same for ip
  // let roomExists = compose(isNotNil, prop(peer.state.ip));
  // let peerExists = compose(isNotNil, prop(peer.state.id));
  // let isPeerInRoom = both(roomExists, peerExists);

  // Since peer is to be kicked out, remove any timers that are set
  cancelPreviousKeepAliveTimer(peer);

  // remove peer from room
  // delete this._rooms[peer.ip][peer.id];

  // close peer stream
  peer.state.stream.end();

  // delete room if empty
  // if (Object.keys(this._rooms[peer.ip]).length === 0) {
  //   delete this._rooms[peer.ip];
  // else {
  // Notify other peers in the room that a peer has left
  // let peersInRoomObj = this._rooms[peer.ip];
  // let getMsg = compose(getMessage(__, "peer-list"), msgBody);
  // Object.values(peersInRoomObj).forEach((peer) =>
  //   sendMessage(peer, getMsg(peersInRoomObj), ws)
  // );
};

const cancelPreviousKeepAliveTimer = (peer: Peer) => {
  let peerAndTimerIdPresent = both(isNotNil, isPropPresent("timerId"));
  peerAndTimerIdPresent(peer) && clearTimeout(peer.state.timerId);
};

import expressWs from "express-ws";
import { Peer_, isPropPresent, getuuid } from "./utils";
import { IncomingHttpHeaders, IncomingMessage } from "http";
import { assoc, both, complement, compose, gt, clone, identity, ifElse, InputTypesOfFns, isNil, prop, __, evolve, mergeDeepLeft } from "ramda";
import { Message, Peer, Room, ServerState } from "./types";
const express = require('express');
const expressWebSocket = require('express-ws');
const websocketStream = require('websocket-stream/stream');
const app = express();

// extend express app with app.ws()
let expressWsInstance : expressWs.Instance = expressWebSocket(app, null, {
    // ws options here
    perMessageDeflate: false,
});
 
// on new connection we first mutate the incoming request headers to add a peerId if not already present
expressWsInstance.getWss().on('headers', function(headers: any, request : any) {    
    
  });

expressWsInstance.getWss().on('connection', function(ws: any, req : IncomingMessage) {
    console.log('connection open');
  });

let rooms : ServerState = {};

app.ws('/', function(ws: any, req : any) {  
    // Add peerId to incoming request
    req['peerId'] = getuuid();
    // convert ws instance to stream
    const stream = websocketStream(ws, {
        // websocket-stream options
        protocol : 'string'
    });

    stream.socket.on('message', (data: any) => {
        console.log(data, "Message");
    })

    // Create a new Peer util object on each new connection
    let peer = Peer_(req, stream);
    let peerIp : string = peer.operations.getIp();
    let peerId = peer.operations.getPeerId();

    // Assign a room to the peer, and return new state
    rooms = joinRoom(rooms, peer, peerIp, peerId);

    // Notify other peers in the room that a new peer has joined
    let peersInRoomObj : Room = rooms[peerIp];

    // Get message body
    let msg = msgBody(peersInRoomObj);

    // send this msg to all peers in the room
    Object.values(peersInRoomObj).forEach(peer => sendMessage(peer, msg, ws));

    // print any incoming messages to the console
    stream.pipe(process.stdout); 
});
 
app.listen(3000);

const GetPeerId = (request : any, headers : IncomingHttpHeaders) => {
    const getPeerIdIndex = (headers : any) => headers.cookie?.indexOf("peerid=");
    const doesPeerIdExistInCookie = compose(gt(__, -1), getPeerIdIndex);
    const doesResponseHeadersHaveCookieWithPeerId = both(isPropPresent('cookie'), doesPeerIdExistInCookie);
    const peerIdExists : any = compose(doesResponseHeadersHaveCookieWithPeerId, prop('headers'));

    let getPeerId = () => getuuid();

    let peerId : any = ifElse(complement(peerIdExists),getPeerId, () => {});

    return peerId(request);

}

const joinRoom = (currentState : ServerState, peer: Peer, peerIp : string, peerId : string) : any => {   
    // Check if a room with the peer's IP exists
    const doesRoomExist = compose(complement(isNil), prop(peerIp));
    // If room does not exist, create a new room
    let newState : any = ifElse(doesRoomExist,identity, assoc(peerIp,{}))(currentState);
    newState[peerIp][peerId] = peer;
    
    // return new server state
    return newState;
}

const sendMessage = (peer : Peer, message : any, ws : any) => {
    if (!peer || ws.readyState !== ws.OPEN) return;
    let msg = JSON.stringify(message);
    peer.state.stream.write(msg);
}

const msgBody = (peers : Room) : Message[] => {
    return Object.keys(peers).map(key => ({
        id : key,
        name : peers[key].operations.getPeerName(),
        supportsRtc : peers[key].operations.isRtcCapable()
    }));
}

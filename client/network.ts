import { or, map } from "ramda";
import { ConnectionStates } from "./types";

const window = (window : any) => ({
  url: () => or(window.URL, window.webkitURL),
  isRtcSupported: () =>
    !!(
      window.RTCPeerConnection ||
      window.mozRTCPeerConnection ||
      window.webkitRTCPeerConnection
    ),
});

const ServerConnection = {
  state: {
    reconnectTimeoutId: (connect) => setTimeout(() => connect(), 5000),
    socket:()=>{},
    _isConnected: false,
  },
  effects: {
    updateSocket: (socket) => {},
  },
  connect: (
    reconnectTimeoutId,
    Connected,
    isConnecting,
    endpoint,
    onMessage,
    onDisconnect
  ) => {
    console.log("WS: Starting to connect to server");
    clearTimeout(reconnectTimeoutId);
    const ws = new WebSocket(endpoint);
  },
};


const init = [
  {
  connectionStatus: ConnectionStates.Disconnected,
  endpoint: "ws://localhost:8080",
 }
]
const attachHandlersToWebSocket = (socket) => {
  socket.onmessage = (event) => {
    console.log("WS: Message received");
  };
  socket.onopen = () => {
    console.log("WS: Connected to server");
  };
  socket.onclose = () => {
    console.log("WS: Disconnected from server");
  };
  return socket;
}

let MapperFnToNewState = map(
  (state) => ({
    ...state,
    ws: attachHandlersToWebSocket(
      new WebSocket(state.endpoint)
    ),
    connectionStatus : ConnectionStates.Connected
}), init)



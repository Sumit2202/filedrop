var process : NodeJS.Process = require("process");

// Handle SIGINT
process.on("SIGINT", () => {
  console.info("SIGINT Received, exiting...");
  process.exit(0);
});

// Handle SIGTERM
process.on("SIGTERM", () => {
  console.info("SIGTERM Received, exiting...");
  process.exit(0);
});

let createFileDropServer = (port : Number) => {
  let wss = null;
  const WebSocket = require('ws');
  wss = new WebSocket.Server({ port: port });
};



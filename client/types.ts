
export enum ConnectionStates {
    Connected,
    Connecting,
    Disconnected
  }
  
export enum DisconnectedStateActions {
    Connect
  }
  
export type InitialConnectionState = ConnectionStates.Disconnected;
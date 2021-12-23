
enum ConnectionStates {
    Connected,
    Connecting,
    Disconnected
  }
  
  enum DisconnectedStateActions {
    Connect
  }
  
  type InitialConnectionState = ConnectionStates.Disconnected;
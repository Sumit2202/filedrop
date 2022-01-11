export type PeerOperationsType = {
  getPeerId: () => void;
  getIp: () => string | undefined;
  isRtcCapable: () => boolean;
  getPeerName: () => {
    model: string;
    os: string;
    browser: string;
    type: string;
    deviceName: string;
    displayName: string;
  };
};

type Ip = string | undefined;

type PeerName = {
  model: string;
  os: string;
  browser: string;
  type: string;
  deviceName: string;
  displayName: string;
};

export type Peer = {
  state: {
    timerId: NodeJS.Timeout | null;
    lastBeat: number;
    connectedTo: Peer[];
    stream: any;
  };
  operations: {
    getPeerId: () => string;
    getIp: () => string;
    isRtcCapable: () => boolean;
    getPeerName: () => PeerName;
  };
};

export type Message = { id: string; name: PeerName; supportsRtc: boolean };

export type Room = Record<string, Peer>;

export type ServerState = Record<string, Room>;

export type MessageType = {
  type: string;
  body: any;
};

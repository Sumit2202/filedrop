import {
  both,
  complement,
  cond,
  either,
  equals,
  hasPath,
  identity,
  ifElse,
  isNil,
  prop,
  propSatisfies,
  gt,
  __,
} from "ramda";
import { IncomingMessage } from "http";
import { Peer } from "./types";
const {
  uniqueNamesGenerator,
  animals,
  colors,
} = require("unique-names-generator");
const parser = require("ua-parser-js");

export const isNotNil = complement(isNil);

export const isPropPresent: any = propSatisfies(isNotNil);

// return a unique Id
export const getuuid = () => {
  let uuid = "",
    ii: number;
  for (ii = 0; ii < 32; ii += 1) {
    switch (ii) {
      case 8:
      case 20:
        uuid += "-";
        uuid += ((Math.random() * 16) | 0).toString(16);
        break;
      case 12:
        uuid += "-";
        uuid += "4";
        break;
      case 16:
        uuid += "-";
        uuid += ((Math.random() * 4) | 8).toString(16);
        break;
      default:
        uuid += ((Math.random() * 16) | 0).toString(16);
    }
  }
  return uuid;
};

//  const memoizer = (fun) => {
//   let cache = {}
//   return function (n){
//       if (cache[n] != undefined ) {
//         return cache[n]
//       } else {
//         let result = fun(n)
//         cache[n] = result
//         return result
//       }
//   }
// }

export const Peer_ = (request: IncomingMessage, stream: any): Peer => ({
  state: {
    timerId: null,
    lastBeat: Date.now(), // (MUTATION) gets set for keepalive
    connectedTo: [],
    stream: stream,
  },

  operations: {
    // Taken an IncomingRequest we do the following operations:

    // IncomingRequest -> PeerId
    getPeerId: () => {
      const replacePeerIdCookie = (
        request: IncomingMessage & { peerId: string }
      ) => {
        return request.headers.cookie?.replace("peerid=", "");
      };

      const peerIdProp = "peerId";

      const isPeerIdPropPresent = isPropPresent(peerIdProp);

      //request -> peerId
      const getPeerId_: any = ifElse(
        isPeerIdPropPresent,
        prop("peerId"),
        replacePeerIdCookie
      );

      return getPeerId_(request);
    },

    //IncomingRequest -> Ip
    getIp: (): string => {
      // ===================================================================
      //CODE TO RESUE:
      // const ip = [''];

      // const getIpFromForwardedForHeaders = (request) => {
      //   const xForwardedForHeaderProp = "x-forwarded-for";
      //    if(request.headers['x-forwarded-for'])
      //    return request.headers['x-forwarded-for'].split(/\s*,\s*/)[0]
      // }

      // const ipv6loopback = "::1";
      // const ipv4loopback = "::ffff:127.0.1"

      // const isIpv6orIpv4Loopback = either(_.equals(ipv6loopback), _.equals(ipv4loopback));

      // if(2){return 2}
      // else {
      //     const remoteAddressPathForRequest = ['connection', 'remoteAddress'];
      //     this.ip = request.connection.remoteAddress;
      //   }
      //   // IPv4 and IPv6 use different values to refer to localhost
      //   if (this.ip == "::1" || this.ip == "::ffff:127.0.0.1") {
      //     this.ip = "127.0.0.1";
      //   }
      // }

      // //if(isIpv6orIpv4Loopback(ip)) return "127.0.0.1";

      // ===================================================================

      let ip: string | undefined = "";
      if (request.headers["x-forwarded-for"]) {
        ip = (request.headers["x-forwarded-for"] as string).split(/\s*,\s*/)[0];
      } else {
        ip = request.socket.remoteAddress;
      }
      // IPv4 and IPv6 use different values to refer to localhost
      if (ip == "::1" || ip == "::ffff:127.0.0.1") {
        ip = "127.0.0.1";
      }

      return ip as string;
    },

    // IncomingRequest -> Boolean
    isRtcCapable: () => {
      const getWebRtcIndex: any = (req: IncomingMessage) =>
        req.url?.indexOf("webrtc");
      return gt(-1, getWebRtcIndex(request));
    },

    // IncomingRequest -> String
    getPeerName: () => {
      let ua = parser(request.headers["user-agent"]);
      let deviceName = "";
      if (ua.os && ua.os.name) {
        deviceName = ua.os.name.replace("Mac OS", "Mac") + " ";
      }

      if (ua.device.model) {
        deviceName += ua.device.model;
      } else {
        deviceName += ua.browser.name;
      }

      if (!deviceName) {
        deviceName = "Unknown Device";
      }

      const displayName = uniqueNamesGenerator({
        length: 2,
        separator: " ",
        dictionaries: [colors, animals],
        style: "capital",
        getSeed: (peerId: any) => {
          const getHashcode = (str: string) => {
            var hash = 0,
              i: number,
              chr: number;
            for (i = 0; i < str.length; i++) {
              chr = str.charCodeAt(i);
              hash = (hash << 5) - hash + chr;
              hash |= 0; // Convert to 32bit integer
            }
            return hash;
          };
          return getHashcode(peerId);
        },
      });

      return {
        model: ua.device.model,
        os: ua.os.name,
        browser: ua.browser.name,
        type: ua.device.type,
        deviceName,
        displayName,
      };
    },
  },
});

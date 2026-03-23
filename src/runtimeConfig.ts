import runtimeConfig from "../shared/runtime-config.json";

export const DEFAULT_VIEWER_PORT = runtimeConfig.defaultViewerPort;
export const WEB_SOCKET_PORT_OFFSET = runtimeConfig.webSocketPortOffset;

interface BrowserLocationLike {
  hostname: string;
  port: string;
  protocol: string;
}

function resolveViewerPort(portText: string) {
  const parsedPort = Number.parseInt(portText, 10);
  if (Number.isInteger(parsedPort) && parsedPort > 0) {
    return parsedPort;
  }

  return DEFAULT_VIEWER_PORT;
}

export function getWebSocketUrl(location: BrowserLocationLike) {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const viewerPort = resolveViewerPort(location.port);
  const webSocketPort = viewerPort + WEB_SOCKET_PORT_OFFSET;
  return `${protocol}//${location.hostname}:${webSocketPort}`;
}

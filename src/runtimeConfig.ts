import runtimeConfig from "../shared/runtime-config.json";

export const DEFAULT_VIEWER_PORT = runtimeConfig.defaultViewerPort;
export const WEB_SOCKET_PORT_OFFSET = runtimeConfig.webSocketPortOffset;
declare const __JSX_VIEWER_WS_PORT__: string | undefined;

interface BrowserLocationLike {
  hostname: string;
  port: string;
  protocol: string;
}

export function parseConfiguredWebSocketPort(portText: string | undefined) {
  if (typeof portText !== "string" || portText.length === 0) {
    return null;
  }

  const parsedPort = Number.parseInt(portText, 10);
  if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
    return null;
  }

  return parsedPort;
}

function resolveViewerPort(portText: string) {
  const parsedPort = Number.parseInt(portText, 10);
  if (Number.isInteger(parsedPort) && parsedPort > 0) {
    return parsedPort;
  }

  return DEFAULT_VIEWER_PORT;
}

export function getWebSocketUrl(
  location: BrowserLocationLike,
  configuredWebSocketPort = parseConfiguredWebSocketPort(
    typeof __JSX_VIEWER_WS_PORT__ === "string" ? __JSX_VIEWER_WS_PORT__ : undefined,
  ),
) {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const webSocketPort =
    configuredWebSocketPort ??
    resolveViewerPort(location.port) + WEB_SOCKET_PORT_OFFSET;
  return `${protocol}//${location.hostname}:${webSocketPort}`;
}

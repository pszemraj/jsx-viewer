import runtimeConfig from "../shared/runtime-config.json";

export const DEFAULT_VIEWER_PORT = runtimeConfig.defaultViewerPort;
export const WEB_SOCKET_PORT_OFFSET = runtimeConfig.webSocketPortOffset;
declare const __JSX_VIEWER_WS_PORT__: string | undefined;

interface BrowserLocationLike {
  hostname: string;
  port: string;
  protocol: string;
}

function parsePositiveInteger(value: string | undefined) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

export function parseConfiguredWebSocketPort(portText: string | undefined) {
  return parsePositiveInteger(portText);
}

export function getWebSocketUrl(
  location: BrowserLocationLike,
  configuredWebSocketPort = parseConfiguredWebSocketPort(
    typeof __JSX_VIEWER_WS_PORT__ === "string" ? __JSX_VIEWER_WS_PORT__ : undefined,
  ),
) {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const viewerPort = parsePositiveInteger(location.port) ?? DEFAULT_VIEWER_PORT;
  const webSocketPort =
    configuredWebSocketPort ?? viewerPort + WEB_SOCKET_PORT_OFFSET;
  return `${protocol}//${location.hostname}:${webSocketPort}`;
}

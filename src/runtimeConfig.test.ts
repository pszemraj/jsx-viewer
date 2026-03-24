import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_VIEWER_PORT,
  WEB_SOCKET_PORT_OFFSET,
  getWebSocketUrl,
  parseConfiguredWebSocketPort,
} from "./runtimeConfig";

type WebSocketUrlCase = readonly [
  name: string,
  location: Parameters<typeof getWebSocketUrl>[0],
  configuredPort: number | undefined,
  expected: string,
];

const webSocketUrlCases: WebSocketUrlCase[] = [
  [
    "derives the WebSocket port from the active viewer port",
    { protocol: "http:", hostname: "localhost", port: "8080" },
    undefined,
    "ws://localhost:8081",
  ],
  [
    "falls back to the documented default ports when the browser port is absent",
    { protocol: "http:", hostname: "127.0.0.1", port: "" },
    undefined,
    `ws://127.0.0.1:${DEFAULT_VIEWER_PORT + WEB_SOCKET_PORT_OFFSET}`,
  ],
  [
    "preserves secure websocket protocol when the viewer is served over https",
    { protocol: "https:", hostname: "viewer.local", port: "9443" },
    undefined,
    "wss://viewer.local:9444",
  ],
  [
    "uses the injected WebSocket port when the viewer runs on a standard port",
    { protocol: "https:", hostname: "viewer.local", port: "" },
    444,
    "wss://viewer.local:444",
  ],
];

for (const [name, location, configuredPort, expected] of webSocketUrlCases) {
  test(name, () => {
    assert.equal(getWebSocketUrl(location, configuredPort), expected);
  });
}

test("ignores invalid injected WebSocket ports", () => {
  for (const value of [undefined, "", "abc", "0"]) {
    assert.equal(parseConfiguredWebSocketPort(value), null);
  }
});

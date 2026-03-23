import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_VIEWER_PORT,
  WEB_SOCKET_PORT_OFFSET,
  getWebSocketUrl,
} from "./runtimeConfig";

test("derives the WebSocket port from the active viewer port", () => {
  assert.equal(
    getWebSocketUrl({
      protocol: "http:",
      hostname: "localhost",
      port: "8080",
    }),
    "ws://localhost:8081",
  );
});

test("falls back to the documented default ports when the browser port is absent", () => {
  assert.equal(
    getWebSocketUrl({
      protocol: "http:",
      hostname: "127.0.0.1",
      port: "",
    }),
    `ws://127.0.0.1:${DEFAULT_VIEWER_PORT + WEB_SOCKET_PORT_OFFSET}`,
  );
});

test("preserves secure websocket protocol when the viewer is served over https", () => {
  assert.equal(
    getWebSocketUrl({
      protocol: "https:",
      hostname: "viewer.local",
      port: "9443",
    }),
    "wss://viewer.local:9444",
  );
});

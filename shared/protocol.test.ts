import assert from "node:assert/strict";
import test from "node:test";
import { isClientMessage, isServerMessage } from "./protocol.mjs";

test("accepts the supported client WebSocket messages", () => {
  assert.equal(
    isClientMessage({
      type: "load-artifact",
      content: "export default function Example() { return null; }",
      filename: "Example.tsx",
    }),
    true,
  );
  assert.equal(isClientMessage({ type: "reset-slot" }), true);
});

test("rejects stale and malformed client WebSocket messages", () => {
  assert.equal(
    isClientMessage({
      type: "load-jsx",
      content: "export default function Legacy() { return null; }",
    }),
    false,
  );
  assert.equal(isClientMessage({ type: "load-artifact" }), false);
  assert.equal(isClientMessage({ type: "reset-slot", extra: true }), true);
});

test("accepts and rejects server WebSocket payloads consistently", () => {
  assert.equal(
    isServerMessage({ type: "file-updated", filename: "Example.tsx" }),
    true,
  );
  assert.equal(isServerMessage({ type: "file-updated", filename: null }), true);
  assert.equal(isServerMessage({ type: "file-updated", filename: 3 }), false);
  assert.equal(isServerMessage({ type: "unknown", filename: null }), false);
});

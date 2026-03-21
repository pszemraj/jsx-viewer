import assert from "node:assert/strict";
import test from "node:test";
import {
  getUnsupportedNodeVersionMessage,
  isSupportedNodeVersion,
} from "./node-version.mjs";

test("accepts the Vite 8-supported Node release lines", () => {
  assert.equal(isSupportedNodeVersion("20.19.0"), true);
  assert.equal(isSupportedNodeVersion("20.22.1"), true);
  assert.equal(isSupportedNodeVersion("22.12.0"), true);
  assert.equal(isSupportedNodeVersion("24.0.0"), true);
});

test("rejects Node versions outside the advertised runtime floor", () => {
  assert.equal(isSupportedNodeVersion("18.20.4"), false);
  assert.equal(isSupportedNodeVersion("20.18.1"), false);
  assert.equal(isSupportedNodeVersion("21.7.3"), false);
  assert.equal(isSupportedNodeVersion("22.11.9"), false);
  assert.equal(isSupportedNodeVersion("invalid"), false);
});

test("formats a clear unsupported-runtime message", () => {
  const message = getUnsupportedNodeVersionMessage("20.18.1");

  assert.match(message, /20\.18\.1/);
  assert.match(message, /Node 20\.19\.0\+ or 22\.12\.0\+/);
  assert.match(message, /Vite 8/);
});

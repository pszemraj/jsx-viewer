import assert from "node:assert/strict";
import test from "node:test";
import {
  getUnsupportedNodeVersionMessage,
  isSupportedNodeVersion,
} from "./node-version.mjs";

test("accepts the Vite 8-supported Node release lines", () => {
  for (const version of ["20.19.0", "20.22.1", "22.12.0", "24.0.0"]) {
    assert.equal(isSupportedNodeVersion(version), true);
  }
});

test("rejects Node versions outside the advertised runtime floor", () => {
  for (const version of ["18.20.4", "20.18.1", "21.7.3", "22.11.9", "invalid"]) {
    assert.equal(isSupportedNodeVersion(version), false);
  }
});

test("formats a clear unsupported-runtime message", () => {
  const message = getUnsupportedNodeVersionMessage("20.18.1");

  assert.match(message, /20\.18\.1/);
  assert.match(message, /Node 20\.19\.0\+ or 22\.12\.0\+/);
  assert.match(message, /Vite 8/);
});

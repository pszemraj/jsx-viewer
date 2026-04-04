import assert from "node:assert/strict";
import test from "node:test";
import {
  BROWSER_PREVIEW_MESSAGE_SOURCE,
  buildPreviewFrameInitMessage,
  getPreviewFrameDocumentUrl,
  isPreviewFrameInitMessage,
} from "./previewFrameDocument";

test("buildPreviewFrameInitMessage keeps the preview bootstrap payload explicit", () => {
  const initMessage = buildPreviewFrameInitMessage({
    artifactUrl: "blob:artifact-url",
    reactDomClientUrl: "https://example.com/runtime/react-dom-client.js",
    reactUrl: "https://example.com/runtime/react.js",
    version: 7,
  });

  assert.deepEqual(initMessage, {
    artifactUrl: "blob:artifact-url",
    mono: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
    reactDomClientUrl: "https://example.com/runtime/react-dom-client.js",
    reactUrl: "https://example.com/runtime/react.js",
    source: BROWSER_PREVIEW_MESSAGE_SOURCE,
    type: "init",
    version: 7,
  });
  assert.equal(isPreviewFrameInitMessage(initMessage), true);
  assert.equal(
    isPreviewFrameInitMessage({
      source: BROWSER_PREVIEW_MESSAGE_SOURCE,
      type: "ready",
      version: 7,
    }),
    false,
  );
});

test("getPreviewFrameDocumentUrl resolves the dedicated preview document on the same origin", () => {
  assert.equal(getPreviewFrameDocumentUrl(), "http://localhost/preview-frame.html");
});

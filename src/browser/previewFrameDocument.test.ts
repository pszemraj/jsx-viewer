import assert from "node:assert/strict";
import test from "node:test";
import {
  BROWSER_PREVIEW_MESSAGE_SOURCE,
  buildPreviewFrameInitMessage,
  getPreviewFrameDocumentUrl,
  isExpectedPreviewFrameMessageEvent,
  isPreviewFrameInitMessage,
} from "./previewFrameDocument";

test("buildPreviewFrameInitMessage keeps the preview bootstrap payload explicit", () => {
  const initMessage = buildPreviewFrameInitMessage({
    artifactUrl: "blob:artifact-url",
    enableTailwindRuntime: true,
    reactDomClientUrl: "https://example.com/runtime/react-dom-client.js",
    reactUrl: "https://example.com/runtime/react.js",
    version: 7,
  });

  assert.deepEqual(initMessage, {
    artifactUrl: "blob:artifact-url",
    enableTailwindRuntime: true,
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

test("preview frame messages require both the expected window and origin", () => {
  const expectedSource = {} as MessageEventSource;
  const otherSource = {} as MessageEventSource;
  const expectedOrigin = "https://example.com";

  assert.equal(
    isExpectedPreviewFrameMessageEvent(
      { origin: expectedOrigin, source: expectedSource },
      expectedSource,
      expectedOrigin,
    ),
    true,
  );
  assert.equal(
    isExpectedPreviewFrameMessageEvent(
      { origin: expectedOrigin, source: otherSource },
      expectedSource,
      expectedOrigin,
    ),
    false,
  );
  assert.equal(
    isExpectedPreviewFrameMessageEvent(
      { origin: "https://other.example", source: expectedSource },
      expectedSource,
      expectedOrigin,
    ),
    false,
  );
  assert.equal(
    isExpectedPreviewFrameMessageEvent(
      { origin: expectedOrigin, source: null },
      null,
      expectedOrigin,
    ),
    false,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  BROWSER_PREVIEW_MESSAGE_SOURCE,
  buildPreviewFrameDocument,
} from "./previewFrameDocument";

test("buildPreviewFrameDocument bootstraps the preview iframe with the runtime urls and artifact blob", () => {
  const html = buildPreviewFrameDocument({
    artifactUrl: "blob:artifact-url",
    reactDomClientUrl: "https://example.com/runtime/react-dom-client.js",
    reactUrl: "https://example.com/runtime/react.js",
    version: 7,
  });

  assert.match(html, /blob:artifact-url/);
  assert.match(html, /runtime\/react\.js/);
  assert.match(html, /runtime\/react-dom-client\.js/);
  assert.match(html, /Loaded artifact must default-export a React component/);
  assert.match(html, /CollectOrigins|collectOrigins/i);
  assert.match(html, new RegExp(BROWSER_PREVIEW_MESSAGE_SOURCE));
  assert.match(html, /version":7|version: 7/);
});

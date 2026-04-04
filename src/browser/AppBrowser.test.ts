import assert from "node:assert/strict";
import test from "node:test";
import {
  getBrowserShellView,
  shouldShowLoadingOverlay,
} from "./AppBrowser";

test("browser shell keeps the preview mounted while an artifact is booting", () => {
  const state = {
    artifact: {
      code: "export default function Example() { return null; }",
      filename: "Example.jsx",
      version: 1,
    },
    error: null,
    isLoading: true,
    status: "Booting preview frame",
  };

  assert.equal(getBrowserShellView(state), "preview");
  assert.equal(shouldShowLoadingOverlay(state), true);
});

test("browser shell falls back to the dropzone only when there is no artifact", () => {
  assert.equal(
    getBrowserShellView({
      artifact: null,
      error: null,
    }),
    "dropzone",
  );
  assert.equal(
    shouldShowLoadingOverlay({
      artifact: null,
      isLoading: true,
      status: "Booting preview frame",
    }),
    false,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildBrowserRuntimeImportMap } from "./runtimeImportMap";

test("buildBrowserRuntimeImportMap points dev imports at source runtime modules", () => {
  assert.deepEqual(buildBrowserRuntimeImportMap("/jsx-viewer/", true), {
    imports: {
      react: "/jsx-viewer/src/browser/runtime/react.ts",
      "react-dom": "/jsx-viewer/src/browser/runtime/react-dom.ts",
      "react-dom/client": "/jsx-viewer/src/browser/runtime/react-dom-client.ts",
      "react/jsx-runtime": "/jsx-viewer/src/browser/runtime/react-jsx-runtime.ts",
      "react/jsx-dev-runtime":
        "/jsx-viewer/src/browser/runtime/react-jsx-dev-runtime.ts",
    },
  });
});

test("buildBrowserRuntimeImportMap points build imports at shipped runtime assets", () => {
  assert.deepEqual(buildBrowserRuntimeImportMap("/", false), {
    imports: {
      react: "/runtime/react.js",
      "react-dom": "/runtime/react-dom.js",
      "react-dom/client": "/runtime/react-dom-client.js",
      "react/jsx-runtime": "/runtime/react-jsx-runtime.js",
      "react/jsx-dev-runtime": "/runtime/react-jsx-dev-runtime.js",
    },
  });
});

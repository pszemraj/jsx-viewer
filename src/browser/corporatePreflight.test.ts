import assert from "node:assert/strict";
import test from "node:test";
import { collectContactedOrigins } from "./corporatePreflight";

test("collectContactedOrigins includes the current origin and dedupes resources", () => {
  const origins = collectContactedOrigins(
    [
      "https://viewer.example/assets/index.js",
      "https://cdn.example/runtime/react.js",
      "https://viewer.example/runtime/chart.js",
      "blob:https://viewer.example/1234",
    ],
    "https://viewer.example",
  );

  assert.deepEqual(origins, [
    "https://cdn.example",
    "https://viewer.example",
  ]);
});

test("collectContactedOrigins ignores non-http origins and invalid URLs", () => {
  const origins = collectContactedOrigins(
    [
      "data:text/plain,hello",
      "blob:https://viewer.example/1234",
      "chrome-extension://abc123/script.js",
      "not a url",
    ],
    "https://viewer.example/app",
  );

  assert.deepEqual(origins, ["https://viewer.example"]);
});

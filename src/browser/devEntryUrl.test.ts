import assert from "node:assert/strict";
import test from "node:test";
import { rewriteBrowserDevRootRequest } from "./devEntryUrl";

test("rewriteBrowserDevRootRequest sends the dev root to the browser entry html", () => {
  assert.equal(rewriteBrowserDevRootRequest("/"), "/index.browser.html");
  assert.equal(
    rewriteBrowserDevRootRequest("/?source=toolbar"),
    "/index.browser.html?source=toolbar",
  );
});

test("rewriteBrowserDevRootRequest leaves non-root requests untouched", () => {
  assert.equal(
    rewriteBrowserDevRootRequest("/index.browser.html"),
    "/index.browser.html",
  );
  assert.equal(rewriteBrowserDevRootRequest("/src/main.tsx"), "/src/main.tsx");
  assert.equal(rewriteBrowserDevRootRequest("/@vite/client"), "/@vite/client");
});

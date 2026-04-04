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

test("rewriteBrowserDevRootRequest rewrites a configured base-path root", () => {
  assert.equal(
    rewriteBrowserDevRootRequest("/jsx-viewer/", "/jsx-viewer/"),
    "/jsx-viewer/index.browser.html",
  );
  assert.equal(
    rewriteBrowserDevRootRequest("/jsx-viewer?source=toolbar", "/jsx-viewer/"),
    "/jsx-viewer/index.browser.html?source=toolbar",
  );
});

test("rewriteBrowserDevRootRequest leaves non-root requests untouched", () => {
  assert.equal(
    rewriteBrowserDevRootRequest("/index.browser.html"),
    "/index.browser.html",
  );
  assert.equal(rewriteBrowserDevRootRequest("/src/main.tsx"), "/src/main.tsx");
  assert.equal(rewriteBrowserDevRootRequest("/@vite/client"), "/@vite/client");
  assert.equal(
    rewriteBrowserDevRootRequest("/jsx-viewer/src/main.tsx", "/jsx-viewer/"),
    "/jsx-viewer/src/main.tsx",
  );
});

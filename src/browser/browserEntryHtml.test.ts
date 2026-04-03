import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("browser entry source html stays free of CSP so Vite dev can inject its preamble", () => {
  const entryHtml = readFileSync(
    new URL("../../index.browser.html", import.meta.url),
    "utf8",
  );

  assert.ok(entryHtml.includes('<div id="root"></div>'));
  assert.ok(
    entryHtml.includes('<script type="module" src="/src/browser/main-browser.tsx"></script>'),
  );
  assert.equal(entryHtml.includes("Content-Security-Policy"), false);
});

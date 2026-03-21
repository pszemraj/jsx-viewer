import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const preCommitHook = readFileSync(
  new URL("../.githooks/pre-commit", import.meta.url),
  "utf8",
);

test("pre-commit hook delegates to the published slot guard script", () => {
  assert.equal(typeof packageJson.scripts?.["guard:slot"], "string");
  assert.match(preCommitHook, /\bnpm run --silent guard:slot\b/);
  assert.doesNotMatch(preCommitHook, /check-slot\.(ts|tsx)\b/);
});

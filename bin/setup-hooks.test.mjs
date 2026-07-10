import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const preCommitHook = readFileSync(
  new URL("../.githooks/pre-commit", import.meta.url),
  "utf8",
);

test("pre-commit hook runs the repo-local slot guard through node", () => {
  assert.match(preCommitHook, /\bnode bin\/check-slot\.mjs\b/);
  assert.doesNotMatch(preCommitHook, /\bnpm\b/);
  assert.doesNotMatch(preCommitHook, /check-slot\.(ts|tsx)\b/);
});

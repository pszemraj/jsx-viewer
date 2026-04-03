import assert from "node:assert/strict";
import test from "node:test";
import lodash, { _, debounce } from "./runtime/lodash";

test("browser runtime lodash facade preserves default and named imports", () => {
  assert.equal(typeof lodash, "function");
  assert.equal(_, lodash);
  assert.equal(typeof debounce, "function");
  assert.equal(lodash.debounce, debounce);
  assert.deepEqual(
    lodash([1, 2]).map((value: number) => value * 2).value(),
    [2, 4],
  );
});

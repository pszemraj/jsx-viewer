import assert from "node:assert/strict";
import test from "node:test";
import PapaParse, {
  BAD_DELIMITERS,
  DefaultDelimiter,
  parse,
  unparse,
} from "./runtime/papaparse";

test("browser runtime papaparse facade preserves default and named imports", () => {
  assert.equal(typeof PapaParse.parse, "function");
  assert.equal(parse, PapaParse.parse);
  assert.equal(typeof unparse, "function");
  assert.equal(DefaultDelimiter, PapaParse.DefaultDelimiter);
  assert.equal(BAD_DELIMITERS, PapaParse.BAD_DELIMITERS);

  const parsed = parse("name,value\nalpha,1", {
    header: true,
  }) as { data: Array<{ name: string; value: string }> };
  assert.deepEqual(parsed.data, [{ name: "alpha", value: "1" }]);
  assert.equal(
    unparse([
      { name: "alpha", value: 1 },
      { name: "beta", value: 2 },
    ]),
    "name,value\r\nalpha,1\r\nbeta,2",
  );
});

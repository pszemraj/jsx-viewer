import assert from "node:assert/strict";
import test from "node:test";
import { forwardRef, lazy, memo } from "react";
import { isSlotComponent } from "./slotComponent";

function PlainComponent() {
  return null;
}

const MemoComponent = memo(PlainComponent);

const ForwardRefComponent = forwardRef<HTMLDivElement, Record<string, never>>(
  function ForwardRefComponent(_props, _ref) {
    return null;
  },
);

const LazyComponent = lazy(async () => ({ default: PlainComponent }));

type SlotComponentCase = readonly [name: string, value: unknown, expected: boolean];

function getWrapperMarker(value: unknown) {
  return (value as { $$typeof?: symbol }).$$typeof;
}

test("wrapper guards match the installed React runtime markers", () => {
  assert.equal(getWrapperMarker(MemoComponent), Symbol.for("react.memo"));
  assert.equal(getWrapperMarker(ForwardRefComponent), Symbol.for("react.forward_ref"));
  assert.equal(getWrapperMarker(LazyComponent), Symbol.for("react.lazy"));
});

for (const [name, value, expected] of [
  ["accepts plain function components", PlainComponent, true],
  ["accepts memo component exports", MemoComponent, true],
  ["accepts forwardRef component exports", ForwardRefComponent, true],
  ["accepts lazy component exports", LazyComponent, true],
  ["rejects null exports", null, false],
  ["rejects plain object exports", {}, false],
  ['rejects string tag exports', "div", false],
] as SlotComponentCase[]) {
  test(name, () => {
    assert.equal(isSlotComponent(value), expected);
  });
}

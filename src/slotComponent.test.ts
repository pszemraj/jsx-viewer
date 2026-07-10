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

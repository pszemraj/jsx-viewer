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

test("accepts plain function components", () => {
  assert.equal(isSlotComponent(PlainComponent), true);
});

test("accepts supported wrapped component exports", () => {
  assert.equal(isSlotComponent(MemoComponent), true);
  assert.equal(isSlotComponent(ForwardRefComponent), true);
  assert.equal(isSlotComponent(LazyComponent), true);
});

test("rejects values that React cannot render as component exports here", () => {
  assert.equal(isSlotComponent(null), false);
  assert.equal(isSlotComponent({}), false);
  assert.equal(isSlotComponent("div"), false);
});

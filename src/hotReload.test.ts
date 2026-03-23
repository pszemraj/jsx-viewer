import assert from "node:assert/strict";
import test from "node:test";
import {
  registerAfterUpdateReload,
  type HotReloadClient,
} from "./hotReload";

test("registerAfterUpdateReload subscribes and unsubscribes the same handler", async () => {
  let registeredListener: (() => void) | undefined;
  let removedListener: (() => void) | undefined;
  let reloadCount = 0;

  const hot: HotReloadClient = {
    on(event, listener) {
      assert.equal(event, "vite:afterUpdate");
      registeredListener = listener;
    },
    off(event, listener) {
      assert.equal(event, "vite:afterUpdate");
      removedListener = listener;
    },
  };

  const dispose = registerAfterUpdateReload(hot, async () => {
    reloadCount += 1;
  });

  assert.equal(typeof registeredListener, "function");
  await registeredListener?.();
  assert.equal(reloadCount, 1);

  dispose();
  assert.equal(removedListener, registeredListener);
});

test("registerAfterUpdateReload tolerates HMR clients without an off hook", () => {
  let registeredListener: (() => void) | undefined;

  const hot: HotReloadClient = {
    on(event, listener) {
      assert.equal(event, "vite:afterUpdate");
      registeredListener = listener;
    },
  };

  const dispose = registerAfterUpdateReload(hot, () => {});

  assert.equal(typeof registeredListener, "function");
  assert.doesNotThrow(() => dispose());
});

test("registerAfterUpdateReload returns a noop disposer when HMR is unavailable", () => {
  const dispose = registerAfterUpdateReload(undefined, () => {});

  assert.doesNotThrow(() => dispose());
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  didUpdateSlotModule,
  registerAfterUpdateReload,
  type HotReloadClient,
} from "./hotReload";

test("registerAfterUpdateReload subscribes and unsubscribes the same handler", async () => {
  const slotModuleUrl = "/@fs/C:/tmp/jsx-viewer/component/View.tsx";
  let registeredListener:
    | ((payload: { updates: Array<{ path: string; acceptedPath: string }> }) => void)
    | undefined;
  let removedListener:
    | ((payload: { updates: Array<{ path: string; acceptedPath: string }> }) => void)
    | undefined;
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
  }, slotModuleUrl);

  assert.equal(typeof registeredListener, "function");
  await registeredListener?.({
    updates: [{ path: slotModuleUrl, acceptedPath: slotModuleUrl }],
  });
  assert.equal(reloadCount, 1);

  dispose();
  assert.equal(removedListener, registeredListener);
});

test("registerAfterUpdateReload tolerates HMR clients without an off hook", () => {
  let registeredListener:
    | ((payload: { updates: Array<{ path: string; acceptedPath: string }> }) => void)
    | undefined;

  const hot: HotReloadClient = {
    on(event, listener) {
      assert.equal(event, "vite:afterUpdate");
      registeredListener = listener;
    },
  };

  const dispose = registerAfterUpdateReload(hot, () => {}, "/component/View.tsx");

  assert.equal(typeof registeredListener, "function");
  assert.doesNotThrow(() => dispose());
});

test("registerAfterUpdateReload returns a noop disposer when HMR is unavailable", () => {
  const dispose = registerAfterUpdateReload(
    undefined,
    () => {},
    "/component/View.tsx",
  );

  assert.doesNotThrow(() => dispose());
});

test("didUpdateSlotModule ignores unrelated shell updates", () => {
  assert.equal(
    didUpdateSlotModule(
      {
        updates: [
          {
            path: "/src/App.tsx",
            acceptedPath: "/src/App.tsx",
          },
        ],
      },
      "/component/View.tsx",
    ),
    false,
  );
});

test("didUpdateSlotModule matches slot updates even when Vite adds a cache-busting query", () => {
  assert.equal(
    didUpdateSlotModule(
      {
        updates: [
          {
            path: "/component/View.tsx?t=123456",
            acceptedPath: "/component/View.tsx?t=123456",
          },
        ],
      },
      "/component/View.tsx",
    ),
    true,
  );
});

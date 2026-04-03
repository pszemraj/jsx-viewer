import assert from "node:assert/strict";
import test from "node:test";
import ReactPackage from "react";
import * as ReactPackageNamespace from "react";
import ReactFacade, * as ReactFacadeNamespace from "./runtime/react";

const ReactPackageRuntime = ReactPackageNamespace as typeof ReactPackageNamespace & {
  readonly __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: unknown;
  readonly unstable_act?: unknown;
};

test("browser runtime react facade matches the public react export surface", () => {
  assert.deepEqual(
    Object.keys(ReactFacadeNamespace).sort(),
    Object.keys(ReactPackageNamespace).sort(),
  );
  assert.equal(ReactFacade, ReactPackage);
});

test("browser runtime react facade preserves additional public exports", () => {
  assert.equal(ReactFacadeNamespace.act, ReactPackageNamespace.act);
  assert.equal(
    ReactFacadeNamespace.createFactory,
    ReactPackageNamespace.createFactory,
  );
  assert.equal(
    ReactFacadeNamespace.unstable_act,
    ReactPackageRuntime.unstable_act,
  );
  assert.equal(
    ReactFacadeNamespace.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
    ReactPackageRuntime.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
  );
});

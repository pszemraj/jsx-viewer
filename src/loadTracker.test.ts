import assert from "node:assert/strict";
import test from "node:test";
import { createLoadTracker } from "./loadTracker";

test("createLoadTracker keeps the latest token current until another load begins", () => {
  const tracker = createLoadTracker();
  const token = tracker.begin();

  assert.equal(tracker.isCurrent(token), true);

  const newerToken = tracker.begin();
  assert.equal(tracker.isCurrent(token), false);
  assert.equal(tracker.isCurrent(newerToken), true);
});

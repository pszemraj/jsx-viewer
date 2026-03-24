import assert from "node:assert/strict";
import test from "node:test";
import { createLoadTracker } from "./loadTracker";

test("createLoadTracker treats only the most recent load token as current", () => {
  const tracker = createLoadTracker();
  const first = tracker.begin();
  const second = tracker.begin();

  assert.equal(tracker.isCurrent(first), false);
  assert.equal(tracker.isCurrent(second), true);
});

test("createLoadTracker keeps the latest token current until another load begins", () => {
  const tracker = createLoadTracker();
  const token = tracker.begin();

  assert.equal(tracker.isCurrent(token), true);

  const newerToken = tracker.begin();
  assert.equal(tracker.isCurrent(token), false);
  assert.equal(tracker.isCurrent(newerToken), true);
});

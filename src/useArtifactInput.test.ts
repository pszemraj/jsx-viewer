import assert from "node:assert/strict";
import test from "node:test";
import { createLatestArtifactFileReader } from "./useArtifactInput";

function createDeferredText() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

function createArtifactFile(name: string, text: Promise<string>) {
  return {
    name,
    text: () => text,
  } as File;
}

test("latest artifact file reader ignores an older read that finishes last", async () => {
  const readLatestArtifactFile = createLatestArtifactFileReader();
  const firstText = createDeferredText();
  const secondText = createDeferredText();

  const firstRead = readLatestArtifactFile(
    createArtifactFile("first.tsx", firstText.promise),
  );
  const secondRead = readLatestArtifactFile(
    createArtifactFile("second.tsx", secondText.promise),
  );

  secondText.resolve("export default function Second() { return null; }");
  assert.deepEqual(await secondRead, {
    content: "export default function Second() { return null; }",
    name: "second.tsx",
  });

  firstText.resolve("export default function First() { return null; }");
  assert.equal(await firstRead, null);
});

test("latest artifact file reader can invalidate a pending read", async () => {
  const readLatestArtifactFile = createLatestArtifactFileReader();
  const text = createDeferredText();
  const pendingRead = readLatestArtifactFile(
    createArtifactFile("stale.tsx", text.promise),
  );

  readLatestArtifactFile.invalidate();
  text.resolve("export default function Stale() { return null; }");

  assert.equal(await pendingRead, null);
});

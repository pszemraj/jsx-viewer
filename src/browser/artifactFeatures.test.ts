import assert from "node:assert/strict";
import test from "node:test";
import { detectBrowserArtifactFeatures } from "./artifactFeatures";

test("detectBrowserArtifactFeatures enables Tailwind runtime for JSX className usage", () => {
  assert.deepEqual(
    detectBrowserArtifactFeatures(`
      export default function Example() {
        return <div className="bg-slate-900 text-white">hi</div>;
      }
    `),
    { enableTailwindRuntime: true },
  );
});

test("detectBrowserArtifactFeatures enables Tailwind runtime for object-style className props", () => {
  assert.deepEqual(
    detectBrowserArtifactFeatures(`
      export default function Example() {
        return React.createElement("div", { className: "grid gap-4" }, "hi");
      }
    `),
    { enableTailwindRuntime: true },
  );
});

test("detectBrowserArtifactFeatures leaves inline-style artifacts alone", () => {
  assert.deepEqual(
    detectBrowserArtifactFeatures(`
      export default function Example() {
        return <div style={{ padding: 24 }}>hi</div>;
      }
    `),
    { enableTailwindRuntime: false },
  );
});

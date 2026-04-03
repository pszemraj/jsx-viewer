import assert from "node:assert/strict";
import test from "node:test";
import { transpileArtifact } from "./transpiler";

test("transpileArtifact rejects actual import.meta.env access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadEnv() {
          return <div>{import.meta.env.MODE}</div>;
        }
      `,
      "BadEnv.tsx",
    ),
    /import\.meta\.env is Vite-specific/,
  );
});

test("transpileArtifact allows import.meta.env in strings and comments", async () => {
  const { code } = await transpileArtifact(
    `
      export default function SnippetDoc() {
        // Example code: import.meta.env.MODE
        const example = "import.meta.env.MODE";

        return <pre>{example}</pre>;
      }
    `,
    "SnippetDoc.tsx",
  );

  assert.match(code, /import\.meta\.env\.MODE/);
});

test("transpileArtifact rejects actual process.env access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadProcessEnv() {
          return <div>{process.env.NODE_ENV}</div>;
        }
      `,
      "BadProcessEnv.tsx",
    ),
    /process\.env is not available in browser mode/,
  );
});

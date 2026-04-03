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

test("transpileArtifact rejects optional-chained process.env access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadOptionalProcessEnv() {
          return <div>{process?.env?.NODE_ENV}</div>;
        }
      `,
      "BadOptionalProcessEnv.tsx",
    ),
    /process\.env is not available in browser mode/,
  );
});

test("transpileArtifact rejects destructured process env access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadProcessEnvDestructure() {
          const { env: runtimeEnv } = process;

          return <div>{runtimeEnv.NODE_ENV}</div>;
        }
      `,
      "BadProcessEnvDestructure.tsx",
    ),
    /process\.env is not available in browser mode/,
  );
});

test("transpileArtifact rejects aliased process env access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadAliasedProcessEnv() {
          const proc = process;

          return <div>{proc.env.NODE_ENV}</div>;
        }
      `,
      "BadAliasedProcessEnv.tsx",
    ),
    /process\.env is not available in browser mode/,
  );
});

test("transpileArtifact rejects destructured import.meta env access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadImportMetaEnvDestructure() {
          const { env } = import.meta;

          return <div>{env.MODE}</div>;
        }
      `,
      "BadImportMetaEnvDestructure.tsx",
    ),
    /import\.meta\.env is Vite-specific/,
  );
});

test("transpileArtifact rejects aliased import.meta env access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadAliasedImportMetaEnv() {
          const meta = import.meta;

          return <div>{meta.env.MODE}</div>;
        }
      `,
      "BadAliasedImportMetaEnv.tsx",
    ),
    /import\.meta\.env is Vite-specific/,
  );
});

test("transpileArtifact rejects assignment-pattern process env destructuring", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadAssignmentPattern() {
          let runtimeEnv;
          ({ env: runtimeEnv } = process);

          return <div>{runtimeEnv.NODE_ENV}</div>;
        }
      `,
      "BadAssignmentPattern.tsx",
    ),
    /process\.env is not available in browser mode/,
  );
});

test("transpileArtifact rejects unbound require() calls", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadRequire() {
          return <div>{require("react")}</div>;
        }
      `,
      "BadRequire.tsx",
    ),
    /CommonJS require\(\) is not supported in browser mode/,
  );
});

test("transpileArtifact rejects aliased require() calls", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadAliasedRequire() {
          const req = require;

          return <div>{req("react")}</div>;
        }
      `,
      "BadAliasedRequire.tsx",
    ),
    /CommonJS require\(\) is not supported in browser mode/,
  );
});

test("transpileArtifact allows locally bound require() calls", async () => {
  const { code } = await transpileArtifact(
    `
      const require = (value: string) => value;

      export default function LocalRequire() {
        return <div>{require("ok")}</div>;
      }
    `,
    "LocalRequire.tsx",
  );

  assert.match(code, /require\("ok"\)/);
});

test("transpileArtifact allows aliased locally bound require() calls", async () => {
  const { code } = await transpileArtifact(
    `
      const require = (value: string) => value;
      const req = require;

      export default function LocalAliasedRequire() {
        return <div>{req("ok")}</div>;
      }
    `,
    "LocalAliasedRequire.tsx",
  );

  assert.match(code, /req\("ok"\)/);
});

test("transpileArtifact rejects aliased module.exports access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadAliasedModuleExports() {
          const runtimeModule = module;
          runtimeModule.exports = {};

          return null;
        }
      `,
      "BadAliasedModuleExports.tsx",
    ),
    /CommonJS exports are not supported in browser mode/,
  );
});

test("transpileArtifact rejects aliased exports member access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadAliasedExports() {
          const runtimeExports = exports;
          runtimeExports.answer = 1;

          return null;
        }
      `,
      "BadAliasedExports.tsx",
    ),
    /CommonJS exports are not supported in browser mode/,
  );
});

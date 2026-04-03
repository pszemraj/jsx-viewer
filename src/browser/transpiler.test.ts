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

test("transpileArtifact rejects aliased process access before runtime", async () => {
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
    /process is not available in browser mode/,
  );
});

test("transpileArtifact rejects direct process member access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadProcessVersion() {
          return <div>{process.version}</div>;
        }
      `,
      "BadProcessVersion.tsx",
    ),
    /process is not available in browser mode/,
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

test("transpileArtifact rejects import.meta env access through aliases reassigned later", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadLateReassignedImportMetaEnv() {
          let meta = import.meta;
          const mode = meta.env.MODE;
          meta = { env: { MODE: "test" } };

          return <div>{mode}</div>;
        }
      `,
      "BadLateReassignedImportMetaEnv.tsx",
    ),
    /import\.meta\.env is Vite-specific/,
  );
});

test("transpileArtifact allows import.meta aliases for supported properties", async () => {
  const { code } = await transpileArtifact(
    `
      export default function ImportMetaUrl() {
        const meta = import.meta;

        return <div>{meta.url}</div>;
      }
    `,
    "ImportMetaUrl.tsx",
  );

  assert.match(code, /meta\.url/);
});

test("transpileArtifact rejects unsupported import.meta member access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadImportMetaGlob() {
          return <div>{String(Boolean(import.meta.glob("./*.tsx")))}</div>;
        }
      `,
      "BadImportMetaGlob.tsx",
    ),
    /import\.meta\.glob is not available inside uploaded artifacts in browser mode/,
  );
});

test("transpileArtifact rejects destructured unsupported import.meta properties", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadImportMetaGlobDestructure() {
          const { glob } = import.meta;

          return <div>{String(Boolean(glob))}</div>;
        }
      `,
      "BadImportMetaGlobDestructure.tsx",
    ),
    /import\.meta\.glob is not available inside uploaded artifacts in browser mode/,
  );
});

test("transpileArtifact rejects import.meta rest destructuring", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadImportMetaRestDestructure() {
          const { ...meta } = import.meta;

          return <div>{String(Boolean(meta.env?.MODE))}</div>;
        }
      `,
      "BadImportMetaRestDestructure.tsx",
    ),
    /import\.meta rest destructuring is not supported inside uploaded artifacts in browser mode/,
  );
});

test("transpileArtifact rejects computed import.meta destructuring", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadImportMetaComputedDestructure() {
          const key = "env";
          const { [key]: runtimeValue } = import.meta;

          return <div>{String(Boolean(runtimeValue))}</div>;
        }
      `,
      "BadImportMetaComputedDestructure.tsx",
    ),
    /Only import\.meta\.url is supported inside uploaded artifacts in browser mode/,
  );
});

test("transpileArtifact allows destructured import.meta.url access", async () => {
  const { code } = await transpileArtifact(
    `
      export default function ImportMetaUrlDestructure() {
        const { url } = import.meta;

        return <div>{url}</div>;
      }
    `,
    "ImportMetaUrlDestructure.tsx",
  );

  assert.match(code, /const\s*\{\s*url\s*\}\s*=\s*import\.meta/);
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

test("transpileArtifact rejects direct require alias assignments", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadAssignedRequireAlias() {
          let req;
          req = require;

          return <div>{String(Boolean(req))}</div>;
        }
      `,
      "BadAssignedRequireAlias.tsx",
    ),
    /CommonJS require\(\) is not supported in browser mode/,
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

test("transpileArtifact rejects zero-arg helper require() calls", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        const getRequire = () => require;

        export default function BadWrappedRequire() {
          return <div>{getRequire()("react")}</div>;
        }
      `,
      "BadWrappedRequire.tsx",
    ),
    /CommonJS require\(\) is not supported in browser mode/,
  );
});

test("transpileArtifact rejects zero-arg helper process.env access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        const getProcess = () => process;

        export default function BadWrappedProcessEnv() {
          return <div>{getProcess().env.NODE_ENV}</div>;
        }
      `,
      "BadWrappedProcessEnv.tsx",
    ),
    /process\.env is not available in browser mode/,
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

test("transpileArtifact allows zero-arg helpers returning local require bindings", async () => {
  const { code } = await transpileArtifact(
    `
      const require = (value: string) => value;
      const getRequire = () => require;

      export default function LocalWrappedRequire() {
        return <div>{getRequire()("ok")}</div>;
      }
    `,
    "LocalWrappedRequire.tsx",
  );

  assert.match(code, /getRequire\(\)\("ok"\)/);
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

test("transpileArtifact rejects aliased module access before runtime", async () => {
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
    /CommonJS module is not supported in browser mode/,
  );
});

test("transpileArtifact rejects direct module.exports access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadModuleExports() {
          module.exports = {};
          return null;
        }
      `,
      "BadModuleExports.tsx",
    ),
    /CommonJS exports are not supported in browser mode/,
  );
});

test("transpileArtifact rejects module.require() member access", async () => {
  await assert.rejects(
    transpileArtifact(
      `
        export default function BadModuleRequire() {
          return <div>{String(Boolean(module.require("react")))}</div>;
        }
      `,
      "BadModuleRequire.tsx",
    ),
    /CommonJS require\(\) is not supported in browser mode/,
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

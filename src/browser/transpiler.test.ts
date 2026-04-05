import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BROWSER_REMOTE_PEER_DEPENDENCY_VERSIONS } from "./remotePackageUrl";
import { transpileArtifact } from "./transpiler";
import { resolveRuntimeModuleUrl } from "./runtimeUrl";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRemoteDepsPattern() {
  return new RegExp(
    `deps=react(?:@|%40)${escapeRegExp(
      BROWSER_REMOTE_PEER_DEPENDENCY_VERSIONS.react,
    )}(?:%2C|,)react-dom(?:@|%40)${escapeRegExp(
      BROWSER_REMOTE_PEER_DEPENDENCY_VERSIONS["react-dom"],
    )}`,
  );
}

function rejectionTest(
  name: string,
  filename: string,
  source: string,
  error: RegExp,
) {
  test(name, async () => {
    await assert.rejects(transpileArtifact(source, filename), error);
  });
}

function allowTest(
  name: string,
  filename: string,
  source: string,
  matches: RegExp[],
) {
  test(name, async () => {
    const { code } = await transpileArtifact(source, filename);

    for (const pattern of matches) {
      assert.match(code, pattern);
    }
  });
}

function allowExampleTest(
  name: string,
  relativePath: string,
  options: {
    enableTailwindRuntime: boolean;
    matches: RegExp[];
  },
) {
  test(name, async () => {
    const source = readFileSync(
      new URL(`../../example/${relativePath}`, import.meta.url),
      "utf8",
    );
    const { code, features } = await transpileArtifact(source, relativePath);

    assert.equal(
      features.enableTailwindRuntime,
      options.enableTailwindRuntime,
    );

    for (const pattern of options.matches) {
      assert.match(code, pattern);
    }
  });
}

test("resolveRuntimeModuleUrl prefixes Vite base for dev runtime modules", () => {
  assert.equal(
    resolveRuntimeModuleUrl("react", {
      basePath: "/jsx-viewer/",
      dev: true,
      origin: "https://example.com",
    }),
    "https://example.com/jsx-viewer/src/browser/runtime/react.ts",
  );
});

test("resolveRuntimeModuleUrl prefixes Vite base for built runtime modules", () => {
  assert.equal(
    resolveRuntimeModuleUrl("react", {
      basePath: "/jsx-viewer/",
      origin: "https://example.com",
    }),
    "https://example.com/jsx-viewer/runtime/react.js",
  );
});

allowTest(
  "transpileArtifact rewrites supported react imports to the browser runtime",
  "ReactImport.tsx",
  `
    import { useState } from "react";

    export default function ReactImport() {
      const [count] = useState(1);
      return <div>{count}</div>;
    }
  `,
  [/runtime\/react\.js/, /useState/],
);

allowTest(
  "transpileArtifact rewrites non-React bare imports to the remote browser package runtime",
  "LucideImport.tsx",
  `
    import { AlarmClock } from "lucide-react";

    export default function LucideImport() {
      return <AlarmClock />;
    }
  `,
  [
    /https:\/\/esm\.sh\/lucide-react\?/,
    buildRemoteDepsPattern(),
    /external=react(?:%2C|,)react-dom(?:%2C|,)react-dom%2Fclient/,
    /target=es2022/,
  ],
);

allowTest(
  "transpileArtifact rewrites react-dom/client imports to the browser runtime",
  "ReactDomClientImport.tsx",
  `
    import { createRoot } from "react-dom/client";

    export default function ReactDomClientImport() {
      return <div>{String(Boolean(createRoot))}</div>;
    }
  `,
  [/runtime\/react-dom-client\.js/, /createRoot/],
);

rejectionTest(
  "transpileArtifact rejects package stylesheet imports before runtime",
  "PackageStylesheetImport.tsx",
  `
    import "react-datepicker/dist/react-datepicker.css";

    export default function PackageStylesheetImport() {
      return <div>datepicker</div>;
    }
  `,
  /Package stylesheet imports are not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects unsupported node scheme imports before esm.sh fallback",
  "NodeSchemeImport.tsx",
  `
    import { Buffer } from "node:buffer";

    export default function NodeSchemeImport() {
      return <div>{String(Boolean(Buffer))}</div>;
    }
  `,
  /Unsupported import scheme "node:" in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects unsupported file scheme imports before esm.sh fallback",
  "FileSchemeImport.tsx",
  `
    import thing from "file:///tmp/example.js";

    export default function FileSchemeImport() {
      return <div>{String(Boolean(thing))}</div>;
    }
  `,
  /Unsupported import scheme "file:" in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects unsupported npm scheme dynamic imports before esm.sh fallback",
  "NpmSchemeDynamicImport.tsx",
  `
    export default async function NpmSchemeDynamicImport() {
      const react = await import("npm:react");
      return <div>{String(Boolean(react))}</div>;
    }
  `,
  /Unsupported import scheme "npm:" in browser mode/,
);

allowExampleTest(
  "transpileArtifact accepts the shipped PolyField example",
  "PolyField.tsx",
  {
    enableTailwindRuntime: false,
    matches: [/runtime\/react\.js/, /forwardRef/, /useImperativeHandle/],
  },
);

allowExampleTest(
  "transpileArtifact accepts the shipped DataTable example",
  "DataTable.jsx",
  {
    enableTailwindRuntime: false,
    matches: [/runtime\/react\.js/, /React\.Children/, /lazy\(\(\) => Promise\.resolve/],
  },
);

allowExampleTest(
  "transpileArtifact accepts the shipped Dashboard example",
  "Dashboard.tsx",
  {
    enableTailwindRuntime: true,
    matches: [
      /runtime\/react\.js/,
      /https:\/\/esm\.sh\/lucide-react\?/,
      /https:\/\/esm\.sh\/recharts\?/,
      buildRemoteDepsPattern(),
    ],
  },
);

rejectionTest(
  "transpileArtifact rejects actual import.meta.env access",
  "BadEnv.tsx",
  `
    export default function BadEnv() {
      return <div>{import.meta.env.MODE}</div>;
    }
  `,
  /import\.meta\.env is Vite-specific/,
);

allowTest(
  "transpileArtifact allows import.meta.env in strings and comments",
  "SnippetDoc.tsx",
  `
    export default function SnippetDoc() {
      // Example code: import.meta.env.MODE
      const example = "import.meta.env.MODE";

      return <pre>{example}</pre>;
    }
  `,
  [/import\.meta\.env\.MODE/],
);

rejectionTest(
  "transpileArtifact rejects actual process.env access",
  "BadProcessEnv.tsx",
  `
    export default function BadProcessEnv() {
      return <div>{process.env.NODE_ENV}</div>;
    }
  `,
  /process\.env is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects optional-chained process.env access",
  "BadOptionalProcessEnv.tsx",
  `
    export default function BadOptionalProcessEnv() {
      return <div>{process?.env?.NODE_ENV}</div>;
    }
  `,
  /process\.env is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects destructured process env access",
  "BadProcessEnvDestructure.tsx",
  `
    export default function BadProcessEnvDestructure() {
      const { env: runtimeEnv } = process;

      return <div>{runtimeEnv.NODE_ENV}</div>;
    }
  `,
  /process\.env is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects aliased process access before runtime",
  "BadAliasedProcessEnv.tsx",
  `
    export default function BadAliasedProcessEnv() {
      const proc = process;

      return <div>{proc.env.NODE_ENV}</div>;
    }
  `,
  /process is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects direct process member access",
  "BadProcessVersion.tsx",
  `
    export default function BadProcessVersion() {
      return <div>{process.version}</div>;
    }
  `,
  /process is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects globalThis process.env access",
  "BadGlobalThisProcessEnv.tsx",
  `
    export default function BadGlobalThisProcessEnv() {
      return <div>{globalThis.process.env.NODE_ENV}</div>;
    }
  `,
  /process\.env is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects process env access through aliased global objects",
  "BadAliasedGlobalProcessEnv.tsx",
  `
    export default function BadAliasedGlobalProcessEnv() {
      const root = globalThis;

      return <div>{root.process?.env?.NODE_ENV}</div>;
    }
  `,
  /process\.env is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects window process env access",
  "BadWindowProcessEnv.tsx",
  `
    export default function BadWindowProcessEnv() {
      return <div>{window.process?.env?.NODE_ENV}</div>;
    }
  `,
  /process\.env is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects bare process value references",
  "BadProcessValue.tsx",
  `
    export default function BadProcessValue() {
      return <div>{String(Boolean(process))}</div>;
    }
  `,
  /process is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects destructured globalThis process aliases",
  "BadDestructuredGlobalThisProcess.tsx",
  `
    export default function BadDestructuredGlobalThisProcess() {
      const { process } = globalThis;

      return <div>{process.env.NODE_ENV}</div>;
    }
  `,
  /process is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects destructured require aliases from global object aliases",
  "BadDestructuredAliasedGlobalRequire.tsx",
  `
    export default function BadDestructuredAliasedGlobalRequire() {
      const root = window;
      const { require } = root;

      return <div>{require("react")}</div>;
    }
  `,
  /CommonJS require\(\) is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects assignment destructuring unsupported globals from self",
  "BadAssignedSelfModule.tsx",
  `
    export default function BadAssignedSelfModule() {
      let runtimeModule;
      ({ module: runtimeModule } = self);

      return <div>{String(Boolean(runtimeModule))}</div>;
    }
  `,
  /CommonJS module is not supported in browser mode/,
);

allowTest(
  "transpileArtifact allows typeof probes for unsupported globals",
  "SafeTypeofProbes.tsx",
  `
    export default function SafeTypeofProbes() {
      return <div>{[
        typeof process,
        typeof require,
        typeof module,
        typeof exports,
      ].join(",")}</div>;
    }
  `,
  [/typeof process/, /typeof require/, /typeof module/, /typeof exports/],
);

allowTest(
  "transpileArtifact allows direct typeof probes on global-object process aliases",
  "SafeGlobalProcessTypeofProbes.tsx",
  `
    export default function SafeGlobalProcessTypeofProbes() {
      const root = globalThis;

      return <div>{[
        typeof globalThis.process,
        typeof window["process"],
        typeof self.process,
        typeof root.process,
      ].join(",")}</div>;
    }
  `,
  [
    /typeof globalThis\.process/,
    /typeof window\["process"\]/,
    /typeof self\.process/,
    /typeof root\.process/,
  ],
);

allowTest(
  "transpileArtifact allows destructuring on locally shadowed global object names",
  "LocalWindowProcessDestructure.tsx",
  `
    const window = { process: { env: { NODE_ENV: "test" } } };

    export default function LocalWindowProcessDestructure() {
      const { process } = window;
      return <div>{process.env.NODE_ENV}</div>;
    }
  `,
  [/const\s*\{\s*process\s*\}\s*=\s*window/, /process\.env\.NODE_ENV/],
);

allowTest(
  "transpileArtifact allows member access on locally shadowed global object names",
  "LocalWindowProcessEnv.tsx",
  `
    const window = { process: { env: { NODE_ENV: "test" } } };

    export default function LocalWindowProcessEnv() {
      return <div>{window.process.env.NODE_ENV}</div>;
    }
  `,
  [/window\.process\.env\.NODE_ENV/],
);

rejectionTest(
  "transpileArtifact rejects destructured import.meta env access",
  "BadImportMetaEnvDestructure.tsx",
  `
    export default function BadImportMetaEnvDestructure() {
      const { env } = import.meta;

      return <div>{env.MODE}</div>;
    }
  `,
  /import\.meta\.env is Vite-specific/,
);

rejectionTest(
  "transpileArtifact rejects aliased import.meta env access",
  "BadAliasedImportMetaEnv.tsx",
  `
    export default function BadAliasedImportMetaEnv() {
      const meta = import.meta;

      return <div>{meta.env.MODE}</div>;
    }
  `,
  /import\.meta\.env is Vite-specific/,
);

rejectionTest(
  "transpileArtifact rejects import.meta env access through aliases reassigned later",
  "BadLateReassignedImportMetaEnv.tsx",
  `
    export default function BadLateReassignedImportMetaEnv() {
      let meta = import.meta;
      const mode = meta.env.MODE;
      meta = { env: { MODE: "test" } };

      return <div>{mode}</div>;
    }
  `,
  /import\.meta\.env is Vite-specific/,
);

rejectionTest(
  "transpileArtifact rejects import.meta env access through aliases assigned later",
  "BadLateAssignedImportMetaEnv.tsx",
  `
    export default function BadLateAssignedImportMetaEnv() {
      let meta = {};
      meta = import.meta;

      return <div>{meta.env.MODE}</div>;
    }
  `,
  /import\.meta\.env is Vite-specific/,
);

rejectionTest(
  "transpileArtifact rejects helper-captured import.meta env access after later alias assignment",
  "BadCapturedImportMetaEnv.tsx",
  `
    function readMode() {
      return meta.env.MODE;
    }

    let meta = { url: "fallback" };
    meta = import.meta;

    export default function BadCapturedImportMetaEnv() {
      return <div>{readMode()}</div>;
    }
  `,
  /import\.meta\.env is Vite-specific/,
);

rejectionTest(
  "transpileArtifact rejects class-method import.meta env access after later alias assignment",
  "BadClassMethodImportMetaEnv.tsx",
  `
    class Reader {
      readMode() {
        return meta.env.MODE;
      }
    }

    let meta = { url: "fallback" };
    meta = import.meta;

    export default function BadClassMethodImportMetaEnv() {
      return <div>{new Reader().readMode()}</div>;
    }
  `,
  /import\.meta\.env is Vite-specific/,
);

rejectionTest(
  "transpileArtifact rejects object-method bare import.meta aliases after later assignment",
  "BadObjectMethodImportMetaAlias.tsx",
  `
    const reader = {
      getMeta() {
        return meta;
      },
    };

    let meta = { url: "fallback" };
    meta = import.meta;

    export default function BadObjectMethodImportMetaAlias() {
      return <div>{String(Boolean(reader.getMeta()))}</div>;
    }
  `,
  /Only import\.meta\.url is supported inside uploaded artifacts in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects helper-captured bare import.meta aliases after later assignment",
  "BadCapturedImportMetaAlias.tsx",
  `
    function getMeta() {
      return meta;
    }

    let meta = { url: "fallback" };
    meta = import.meta;

    export default function BadCapturedImportMetaAlias() {
      return getMeta();
    }
  `,
  /Only import\.meta\.url is supported inside uploaded artifacts in browser mode/,
);

allowTest(
  "transpileArtifact allows import.meta aliases for supported properties",
  "ImportMetaUrl.tsx",
  `
    export default function ImportMetaUrl() {
      const meta = import.meta;

      return <div>{meta.url}</div>;
    }
  `,
  [/meta\.url/],
);

allowTest(
  "transpileArtifact allows helper-captured import.meta.url access after later alias assignment",
  "CapturedImportMetaUrl.tsx",
  `
    function readUrl() {
      return meta.url;
    }

    let meta = { url: "fallback" };
    meta = import.meta;

    export default function CapturedImportMetaUrl() {
      return <div>{readUrl()}</div>;
    }
  `,
  [/meta\.url/, /readUrl\(\)/],
);

allowTest(
  "transpileArtifact allows object-method import.meta.url access after later alias assignment",
  "ObjectMethodImportMetaUrl.tsx",
  `
    const reader = {
      readUrl() {
        return meta.url;
      },
    };

    let meta = { url: "fallback" };
    meta = import.meta;

    export default function ObjectMethodImportMetaUrl() {
      return <div>{reader.readUrl()}</div>;
    }
  `,
  [/meta\.url/, /reader\.readUrl\(\)/],
);

allowTest(
  "transpileArtifact allows import.meta.url through aliases assigned later",
  "LateAssignedImportMetaUrl.tsx",
  `
    export default function LateAssignedImportMetaUrl() {
      let meta = { url: "fallback" };
      meta = import.meta;

      return <div>{meta.url}</div>;
    }
  `,
  [/meta\.url/],
);

allowTest(
  "transpileArtifact allows safe later reassignments after import.meta aliasing",
  "ReassignedImportMetaAlias.tsx",
  `
    export default function ReassignedImportMetaAlias() {
      let meta = import.meta;
      meta = { url: "runtime" };

      return <div>{meta.url}</div>;
    }
  `,
  [/meta\.url/],
);

allowTest(
  "transpileArtifact allows destructuring url from import.meta aliases",
  "ImportMetaAliasDestructure.tsx",
  `
    export default function ImportMetaAliasDestructure() {
      const meta = import.meta;
      const { url } = meta;

      return <div>{url}</div>;
    }
  `,
  [/const meta = import\.meta/, /const\s*\{\s*url\s*\}\s*=\s*meta/],
);

rejectionTest(
  "transpileArtifact rejects direct bare import.meta escapes",
  "BadBareImportMeta.tsx",
  `
    export default function BadBareImportMeta() {
      return import.meta;
    }
  `,
  /Only import\.meta\.url is supported inside uploaded artifacts in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects import.meta aliases that escape as full objects",
  "BadImportMetaAliasEscape.tsx",
  `
    export default function BadImportMetaAliasEscape() {
      const meta = import.meta;
      return meta;
    }
  `,
  /Only import\.meta\.url is supported inside uploaded artifacts in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects helpers that return import.meta directly",
  "BadWrappedImportMeta.tsx",
  `
    const getMeta = () => import.meta;

    export default function BadWrappedImportMeta() {
      return getMeta();
    }
  `,
  /Only import\.meta\.url is supported inside uploaded artifacts in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects unsupported import.meta member access",
  "BadImportMetaGlob.tsx",
  `
    export default function BadImportMetaGlob() {
      return <div>{String(Boolean(import.meta.glob("./*.tsx")))}</div>;
    }
  `,
  /import\.meta\.glob is not available inside uploaded artifacts in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects destructured unsupported import.meta properties",
  "BadImportMetaGlobDestructure.tsx",
  `
    export default function BadImportMetaGlobDestructure() {
      const { glob } = import.meta;

      return <div>{String(Boolean(glob))}</div>;
    }
  `,
  /import\.meta\.glob is not available inside uploaded artifacts in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects import.meta rest destructuring",
  "BadImportMetaRestDestructure.tsx",
  `
    export default function BadImportMetaRestDestructure() {
      const { ...meta } = import.meta;

      return <div>{String(Boolean(meta.env?.MODE))}</div>;
    }
  `,
  /import\.meta rest destructuring is not supported inside uploaded artifacts in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects computed import.meta destructuring",
  "BadImportMetaComputedDestructure.tsx",
  `
    export default function BadImportMetaComputedDestructure() {
      const key = "env";
      const { [key]: runtimeValue } = import.meta;

      return <div>{String(Boolean(runtimeValue))}</div>;
    }
  `,
  /Only import\.meta\.url is supported inside uploaded artifacts in browser mode/,
);

allowTest(
  "transpileArtifact allows destructured import.meta.url access",
  "ImportMetaUrlDestructure.tsx",
  `
    export default function ImportMetaUrlDestructure() {
      const { url } = import.meta;

      return <div>{url}</div>;
    }
  `,
  [/const\s*\{\s*url\s*\}\s*=\s*import\.meta/],
);

rejectionTest(
  "transpileArtifact rejects assignment-pattern process env destructuring",
  "BadAssignmentPattern.tsx",
  `
    export default function BadAssignmentPattern() {
      let runtimeEnv;
      ({ env: runtimeEnv } = process);

      return <div>{runtimeEnv.NODE_ENV}</div>;
    }
  `,
  /process\.env is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects direct process reassignment",
  "BadProcessReassignment.tsx",
  `
    export default function BadProcessReassignment() {
      process = { env: { NODE_ENV: "production" } };
      return null;
    }
  `,
  /process is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects destructured writes to unsupported globals",
  "BadDestructuredWrite.tsx",
  `
    export default function BadDestructuredWrite() {
      ({ value: require } = { value: () => "ok" });
      return null;
    }
  `,
  /CommonJS require\(\) is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects destructured for-of writes to unsupported globals",
  "BadForOfDestructuredWrite.tsx",
  `
    export default function BadForOfDestructuredWrite() {
      for ({ value: require } of [{ value: () => null }]) {
        return null;
      }

      return null;
    }
  `,
  /CommonJS require\(\) is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects array-pattern for-of writes to unsupported globals",
  "BadForOfArrayWrite.tsx",
  `
    export default function BadForOfArrayWrite() {
      for ([module] of [[{}]]) {
        return null;
      }

      return null;
    }
  `,
  /CommonJS module is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects destructured for-in writes to unsupported globals",
  "BadForInDestructuredWrite.tsx",
  `
    export default function BadForInDestructuredWrite() {
      for ({ value: process } in { entry: { value: 1 } }) {
        return null;
      }

      return null;
    }
  `,
  /process is not available in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects direct require alias assignments",
  "BadAssignedRequireAlias.tsx",
  `
    export default function BadAssignedRequireAlias() {
      let req;
      req = require;

      return <div>{String(Boolean(req))}</div>;
    }
  `,
  /CommonJS require\(\) is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects unbound require() calls",
  "BadRequire.tsx",
  `
    export default function BadRequire() {
      return <div>{require("react")}</div>;
    }
  `,
  /CommonJS require\(\) is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects self require() calls",
  "BadSelfRequire.tsx",
  `
    export default function BadSelfRequire() {
      return <div>{self.require?.("react")}</div>;
    }
  `,
  /CommonJS require\(\) is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects aliased require() calls",
  "BadAliasedRequire.tsx",
  `
    export default function BadAliasedRequire() {
      const req = require;

      return <div>{req("react")}</div>;
    }
  `,
  /CommonJS require\(\) is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects aliased globalThis require() calls",
  "BadAliasedGlobalThisRequire.tsx",
  `
    export default function BadAliasedGlobalThisRequire() {
      const req = globalThis.require;

      return <div>{req("react")}</div>;
    }
  `,
  /CommonJS require\(\) is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects zero-arg helper require() calls",
  "BadWrappedRequire.tsx",
  `
    const getRequire = () => require;

    export default function BadWrappedRequire() {
      return <div>{getRequire()("react")}</div>;
    }
  `,
  /CommonJS require\(\) is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects bare require value references",
  "BadBareRequire.tsx",
  `
    export default function BadBareRequire() {
      return require;
    }
  `,
  /CommonJS require\(\) is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects zero-arg helper process.env access",
  "BadWrappedProcessEnv.tsx",
  `
    const getProcess = () => process;

    export default function BadWrappedProcessEnv() {
      return <div>{getProcess().env.NODE_ENV}</div>;
    }
  `,
  /process is not available in browser mode/,
);

allowTest(
  "transpileArtifact allows locally bound require() calls",
  "LocalRequire.tsx",
  `
    const require = (value: string) => value;

    export default function LocalRequire() {
      return <div>{require("ok")}</div>;
    }
  `,
  [/require\("ok"\)/],
);

allowTest(
  "transpileArtifact allows zero-arg helpers returning local require bindings",
  "LocalWrappedRequire.tsx",
  `
    const require = (value: string) => value;
    const getRequire = () => require;

    export default function LocalWrappedRequire() {
      return <div>{getRequire()("ok")}</div>;
    }
  `,
  [/getRequire\(\)\("ok"\)/],
);

allowTest(
  "transpileArtifact allows aliased locally bound require() calls",
  "LocalAliasedRequire.tsx",
  `
    const require = (value: string) => value;
    const req = require;

    export default function LocalAliasedRequire() {
      return <div>{req("ok")}</div>;
    }
  `,
  [/req\("ok"\)/],
);

rejectionTest(
  "transpileArtifact rejects aliased module access before runtime",
  "BadAliasedModuleExports.tsx",
  `
    export default function BadAliasedModuleExports() {
      const runtimeModule = module;
      runtimeModule.exports = {};

      return null;
    }
  `,
  /CommonJS module is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects direct module reassignment",
  "BadModuleReassignment.tsx",
  `
    export default function BadModuleReassignment() {
      module = { exports: {} };
      return null;
    }
  `,
  /CommonJS module is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects bare module value references",
  "BadBareModule.tsx",
  `
    export default function BadBareModule() {
      return module;
    }
  `,
  /CommonJS module is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects direct module.exports access",
  "BadModuleExports.tsx",
  `
    export default function BadModuleExports() {
      module.exports = {};
      return null;
    }
  `,
  /CommonJS exports are not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects globalThis module.exports access",
  "BadGlobalThisModuleExports.tsx",
  `
    export default function BadGlobalThisModuleExports() {
      globalThis.module.exports = {};
      return null;
    }
  `,
  /CommonJS exports are not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects module.require() member access",
  "BadModuleRequire.tsx",
  `
    export default function BadModuleRequire() {
      return <div>{String(Boolean(module.require("react")))}</div>;
    }
  `,
  /CommonJS require\(\) is not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects aliased exports member access",
  "BadAliasedExports.tsx",
  `
    export default function BadAliasedExports() {
      const runtimeExports = exports;
      runtimeExports.answer = 1;

      return null;
    }
  `,
  /CommonJS exports are not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects direct exports reassignment",
  "BadExportsReassignment.tsx",
  `
    export default function BadExportsReassignment() {
      exports = { answer: 42 };
      return null;
    }
  `,
  /CommonJS exports are not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects bare exports value references",
  "BadBareExports.tsx",
  `
    export default function BadBareExports() {
      return exports;
    }
  `,
  /CommonJS exports are not supported in browser mode/,
);

rejectionTest(
  "transpileArtifact rejects self exports member access",
  "BadSelfExports.tsx",
  `
    export default function BadSelfExports() {
      self.exports.answer = 1;
      return null;
    }
  `,
  /CommonJS exports are not supported in browser mode/,
);

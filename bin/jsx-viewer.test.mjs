import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import browserViteConfig, {
  buildBrowserContentSecurityPolicy,
  buildPreviewImportMapScriptContents,
  computeInlineScriptHash,
} from "../vite.config.browser.ts";
import { BROWSER_RUNTIME_ENTRIES } from "../src/browser/runtimeManifest.ts";
import {
  CliUsageError,
  DEFAULT_VIEWER_PORT,
  MAX_VIEWER_PORT,
  SUPPORTED_INPUT_EXTENSIONS,
  WEB_SOCKET_PORT_OFFSET,
  getHelpText,
  getWebSocketPort,
  parseCliArgs,
} from "./jsx-viewer-cli.mjs";
import {
  clearRuntimeArtifacts,
  PLACEHOLDER,
  TRACKED_SLOT_PATH,
  getRuntimeCacheDir,
  getRuntimeCacheRoot,
  getRuntimeOwnerPath,
  getRuntimeRoot,
  getRuntimeSlotsRoot,
  getRuntimeSlotModuleUrl,
  getRuntimeSlotPath,
  markRuntimePortActive,
  readSlot,
  resetSlot,
  slotMatchesPlaceholder,
  writeSlot,
} from "./slot.mjs";
import {
  createQueuedArtifactReload,
  getViteServerConfig,
  waitForCloseOperation,
} from "./jsx-viewer-runtime.mjs";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CLI_PATH = fileURLToPath(new URL("./jsx-viewer.mjs", import.meta.url));
const RUNTIME_SLOTS_ENV = "JSX_VIEWER_RUNTIME_DIR";
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const cliEntrypoint = readFileSync(
  new URL("./jsx-viewer.mjs", import.meta.url),
  "utf8",
);

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [options.cliPath ?? CLI_PATH, ...args], {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      ...options.env,
    },
  });
}

function copyRepoFiles(targetDir, relativePaths) {
  for (const relativePath of relativePaths) {
    const sourcePath = path.join(REPO_ROOT, relativePath);
    const targetPath = path.join(targetDir, relativePath);
    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

function withRuntimeSlotsDir(runtimeSlotsDir, callback) {
  const previousValue = process.env[RUNTIME_SLOTS_ENV];
  process.env[RUNTIME_SLOTS_ENV] = runtimeSlotsDir;

  try {
    return callback();
  } finally {
    if (previousValue === undefined) {
      delete process.env[RUNTIME_SLOTS_ENV];
    } else {
      process.env[RUNTIME_SLOTS_ENV] = previousValue;
    }
  }
}

function getExpectedRuntimeSlotModuleUrl(filePath) {
  const fileUrl = pathToFileURL(filePath);
  return `/@fs${fileUrl.host ? `//${fileUrl.host}${fileUrl.pathname}` : fileUrl.pathname}`;
}

test("cli entrypoint does not depend on the tsx loader", () => {
  assert.doesNotMatch(cliEntrypoint, /tsx\/esm\/api/);
  assert.doesNotMatch(cliEntrypoint, /jsx-viewer\.ts/);
  assert.doesNotMatch(cliEntrypoint, /from "vite"/);
  assert.doesNotMatch(cliEntrypoint, /from "ws"/);
  assert.doesNotMatch(cliEntrypoint, /from "\.\/jsx-viewer-cli\.mjs"/);
  assert.match(cliEntrypoint, /await import\(\s*"\.\/jsx-viewer-cli\.mjs"\s*\)/);
  assert.match(cliEntrypoint, /await import\("\.\/jsx-viewer-runtime\.mjs"\)/);
  assert.equal(existsSync(new URL("./jsx-viewer.ts", import.meta.url)), false);
});

test("cli module loading stays behind the Node version gate", () => {
  const versionGateIndex = cliEntrypoint.indexOf(
    "assertSupportedNodeVersion(process.versions.node)",
  );
  const cliImportIndex = cliEntrypoint.search(
    /await import\(\s*"\.\/jsx-viewer-cli\.mjs"\s*\)/,
  );

  assert.ok(versionGateIndex >= 0);
  assert.ok(cliImportIndex > versionGateIndex);
});

test("cli runtime packages are published as production dependencies", () => {
  const runtimeDependencies = [
    "@vitejs/plugin-react",
    "autoprefixer",
    "postcss",
    "tailwindcss",
    "vite",
  ];

  for (const dependency of runtimeDependencies) {
    assert.equal(typeof packageJson.dependencies?.[dependency], "string");
    assert.equal(packageJson.devDependencies?.[dependency], undefined);
  }
});

test("browser npm entrypoints stay behind the Node version gate", () => {
  const versionGateScript = "node ./bin/check-node-version.mjs";

  assert.equal(packageJson.scripts?.prebuild, versionGateScript);
  assert.equal(packageJson.scripts?.["prebuild:browser"], versionGateScript);
  assert.equal(packageJson.scripts?.["predev:browser"], versionGateScript);
  assert.equal(packageJson.scripts?.["prepreview:browser"], versionGateScript);
});

test("browser preview script serves the finalized Pages artifact", () => {
  assert.equal(
    packageJson.scripts?.["preview:browser"],
    "npm run build:browser && vite preview --config vite.config.browser.ts",
  );
});

test("preview frame CSP hashes the inline import map instead of requiring unsafe-inline", () => {
  const importMap = buildPreviewImportMapScriptContents("/jsx-viewer/", false);
  const hash = computeInlineScriptHash(importMap);
  const csp = buildBrowserContentSecurityPolicy({
    inlineScriptHashes: [hash],
  });
  const scriptSrcDirective = csp
    .split("; ")
    .find((directive) => directive.startsWith("script-src "));

  assert.ok(scriptSrcDirective);
  assert.match(
    scriptSrcDirective,
    /script-src 'self' blob: https:\/\/esm\.sh https:\/\/cdn\.tailwindcss\.com 'sha256-/,
  );
  assert.match(
    scriptSrcDirective,
    new RegExp(hash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.doesNotMatch(scriptSrcDirective, /unsafe-inline/);
});

test("browser CSP allows standard HTTPS image and data requests for trusted artifacts", () => {
  const csp = buildBrowserContentSecurityPolicy();
  const connectSrcDirective = csp
    .split("; ")
    .find((directive) => directive.startsWith("connect-src "));
  const imgSrcDirective = csp
    .split("; ")
    .find((directive) => directive.startsWith("img-src "));

  assert.equal(connectSrcDirective, "connect-src 'self' https: wss:");
  assert.equal(imgSrcDirective, "img-src 'self' https: blob: data:");
});

test("cli reports the package version from package metadata", () => {
  const stdout = execFileSync(process.execPath, [CLI_PATH, "--version"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();

  assert.equal(stdout, packageJson.version);
});

test("metadata-only modes do not load the runtime module", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "jsx-viewer-metadata-"));

  try {
    copyRepoFiles(tempDir, [
      "package.json",
      "bin/jsx-viewer.mjs",
      "bin/jsx-viewer-cli.mjs",
      "bin/node-version.mjs",
      "shared/runtime-config.json",
    ]);

    const tempCliPath = path.join(tempDir, "bin", "jsx-viewer.mjs");

    const versionResult = runCli(["--version"], {
      cliPath: tempCliPath,
      cwd: tempDir,
    });
    assert.equal(versionResult.status, 0);
    assert.equal(versionResult.stderr, "");
    assert.equal(versionResult.stdout.trim(), packageJson.version);

    const helpResult = runCli(["--help"], {
      cliPath: tempCliPath,
      cwd: tempDir,
    });
    assert.equal(helpResult.status, 0);
    assert.equal(helpResult.stderr, "");
    assert.match(helpResult.stdout, /jsx-viewer - render \.jsx\/\.tsx files like \.html/);
    assert.match(helpResult.stdout, /Usage:/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("package metadata points to the public project URLs", () => {
  assert.deepEqual(packageJson.repository, {
    type: "git",
    url: "git+https://github.com/pszemraj/jsx-viewer.git",
  });
  assert.equal(packageJson.homepage, "https://github.com/pszemraj/jsx-viewer#readme");
  assert.deepEqual(packageJson.bugs, {
    url: "https://github.com/pszemraj/jsx-viewer/issues",
  });
});

test("browser optimizeDeps prebundles every shipped browser runtime dependency", () => {
  const optimizeDepsInclude = new Set(
    browserViteConfig.optimizeDeps?.include ?? [],
  );

  for (const dependency of Object.keys(BROWSER_RUNTIME_ENTRIES)) {
    assert.equal(optimizeDepsInclude.has(dependency), true);
  }
});

test("help text documents the actual default port behavior", () => {
  const helpText = getHelpText();
  assert.match(helpText, new RegExp(`default: ${DEFAULT_VIEWER_PORT}`));
  assert.match(helpText, new RegExp(`max: ${MAX_VIEWER_PORT}`));
  assert.match(helpText, new RegExp(`port \\+ ${WEB_SOCKET_PORT_OFFSET}`));
  assert.match(helpText, /Pass zero or one \.jsx\/\.tsx file\./);
});

test("runtime workspace keeps slots and Vite cache outside the tracked package tree", () => {
  const runtimeSlotsBase = mkdtempSync(path.join(os.tmpdir(), "jsx-viewer-slots-"));

  try {
    withRuntimeSlotsDir(runtimeSlotsBase, () => {
      const runtimeSlotsRoot = getRuntimeSlotsRoot();
      const runtimeCacheRoot = getRuntimeCacheRoot();
      const runtimeSlotPath = getRuntimeSlotPath(DEFAULT_VIEWER_PORT);
      const runtimeCacheDir = getRuntimeCacheDir(DEFAULT_VIEWER_PORT);
      const runtimeSlotUrl = getRuntimeSlotModuleUrl(DEFAULT_VIEWER_PORT);
      const viteServerConfig = getViteServerConfig(
        DEFAULT_VIEWER_PORT,
        getWebSocketPort(DEFAULT_VIEWER_PORT),
      );
      const sharedRuntimeRoot = path.join(runtimeSlotsBase, "jsx-viewer");

      assert.equal(path.relative(REPO_ROOT, runtimeSlotPath).startsWith(".."), true);
      assert.equal(path.relative(REPO_ROOT, runtimeCacheDir).startsWith(".."), true);
      assert.equal(path.dirname(runtimeSlotsRoot), sharedRuntimeRoot);
      assert.match(path.basename(runtimeSlotsRoot), /^workspace-[0-9a-f]{12}$/);
      assert.equal(path.dirname(runtimeCacheRoot), runtimeSlotsRoot);
      assert.equal(
        path.dirname(path.dirname(path.dirname(runtimeSlotPath))),
        runtimeSlotsRoot,
      );
      assert.equal(path.dirname(runtimeCacheDir), runtimeCacheRoot);
      assert.equal(path.normalize(TRACKED_SLOT_PATH), path.join(REPO_ROOT, "component", "View.tsx"));
      assert.match(runtimeSlotUrl, /^\/@fs\//);
      assert.match(runtimeSlotUrl.replace(/\\/g, "/"), /\/component\/View\.tsx$/);
      assert.equal(viteServerConfig.cacheDir, runtimeCacheDir);
      assert.deepEqual(viteServerConfig.server.fs.allow, [
        path.resolve(REPO_ROOT),
        getRuntimeRoot(DEFAULT_VIEWER_PORT),
      ]);
    });
  } finally {
    rmSync(runtimeSlotsBase, { recursive: true, force: true });
  }
});

test("runtime slot module URLs encode URL-significant path characters", () => {
  const runtimeSlotsBase = path.join(os.tmpdir(), "jsx-viewer#hash?query");

  withRuntimeSlotsDir(runtimeSlotsBase, () => {
    const runtimeSlotPath = getRuntimeSlotPath(DEFAULT_VIEWER_PORT);
    const runtimeSlotUrl = getRuntimeSlotModuleUrl(DEFAULT_VIEWER_PORT);
    const parsedUrl = new URL(runtimeSlotUrl, "http://localhost");

    assert.equal(parsedUrl.pathname, getExpectedRuntimeSlotModuleUrl(runtimeSlotPath));
    assert.equal(parsedUrl.search, "");
    assert.equal(parsedUrl.hash, "");
    assert.match(runtimeSlotUrl, /%23/);
    assert.match(runtimeSlotUrl, /%3F/);
  });
});

test(
  "runtime slot module URLs preserve UNC hosts on Windows runtime roots",
  { skip: process.platform !== "win32" },
  () => {
    const runtimeSlotsBase = String.raw`\\server\share\runtime-root#hash?query`;

    withRuntimeSlotsDir(runtimeSlotsBase, () => {
      const runtimeSlotPath = getRuntimeSlotPath(DEFAULT_VIEWER_PORT);
      const runtimeSlotUrl = getRuntimeSlotModuleUrl(DEFAULT_VIEWER_PORT);
      const parsedUrl = new URL(runtimeSlotUrl, "http://localhost");

      assert.match(runtimeSlotPath, /^\\\\server\\share\\/);
      assert.equal(parsedUrl.pathname, getExpectedRuntimeSlotModuleUrl(runtimeSlotPath));
      assert.equal(parsedUrl.search, "");
      assert.equal(parsedUrl.hash, "");
      assert.match(runtimeSlotUrl, /^\/@fs\/\/server\/share\//);
      assert.match(runtimeSlotUrl, /%23/);
      assert.match(runtimeSlotUrl, /%3F/);
    });
  },
);

test("slotMatchesPlaceholder accepts the tracked placeholder with CRLF line endings", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "jsx-viewer-slot-"));
  const slotPath = path.join(tempDir, "View.tsx");

  try {
    writeFileSync(slotPath, PLACEHOLDER.replace(/\n/g, "\r\n"), "utf8");
    assert.equal(slotMatchesPlaceholder(slotPath), true);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("clearRuntimeArtifacts removes inactive artifacts in the current workspace only", () => {
  const runtimeSlotsBase = mkdtempSync(path.join(os.tmpdir(), "jsx-viewer-slots-"));

  try {
    withRuntimeSlotsDir(runtimeSlotsBase, () => {
      const runtimeSlotsRoot = getRuntimeSlotsRoot();
      const sharedRuntimeRoot = path.dirname(runtimeSlotsRoot);
      const activePort = 3142;
      const stalePort = 3143;
      const legacyPort = 3144;
      const orphanCachePort = 3145;
      const staleLegacyPort = 3146;
      const managedSlotDir = path.join(runtimeSlotsRoot, `port-${activePort}`);
      const staleSlotDir = path.join(runtimeSlotsRoot, `port-${stalePort}`);
      const legacySlotDir = path.join(runtimeSlotsRoot, `port-${legacyPort}`);
      const staleLegacySlotDir = path.join(runtimeSlotsRoot, `port-${staleLegacyPort}`);
      const managedCacheDir = getRuntimeCacheDir(activePort);
      const staleCacheDir = getRuntimeCacheDir(stalePort);
      const legacyCacheDir = getRuntimeCacheDir(legacyPort);
      const staleLegacyCacheDir = getRuntimeCacheDir(staleLegacyPort);
      const orphanCacheDir = getRuntimeCacheDir(orphanCachePort);
      const unmanagedCacheDir = path.join(getRuntimeCacheRoot(), "notes");
      const lookalikeCacheDir = path.join(getRuntimeCacheRoot(), "port-not-a-number");
      const siblingWorkspaceSlotDir = path.join(
        sharedRuntimeRoot,
        "workspace-sibling",
        "port-4000",
      );
      const siblingWorkspaceCacheDir = path.join(
        sharedRuntimeRoot,
        "workspace-sibling",
        "vite-cache",
        "port-4000",
      );

      mkdirSync(path.join(managedSlotDir, "component"), { recursive: true });
      writeFileSync(path.join(managedSlotDir, "component", "View.tsx"), PLACEHOLDER, "utf8");
      markRuntimePortActive(activePort);
      mkdirSync(managedCacheDir, { recursive: true });
      writeFileSync(path.join(managedCacheDir, "deps.json"), "{}", "utf8");
      mkdirSync(path.join(staleSlotDir, "component"), { recursive: true });
      writeFileSync(path.join(staleSlotDir, "component", "View.tsx"), PLACEHOLDER, "utf8");
      writeFileSync(getRuntimeOwnerPath(stalePort), `${JSON.stringify({ pid: 0 })}\n`, "utf8");
      mkdirSync(staleCacheDir, { recursive: true });
      writeFileSync(path.join(staleCacheDir, "deps.json"), "{}", "utf8");
      mkdirSync(path.join(legacySlotDir, "component"), { recursive: true });
      writeFileSync(path.join(legacySlotDir, "component", "View.tsx"), PLACEHOLDER, "utf8");
      mkdirSync(legacyCacheDir, { recursive: true });
      writeFileSync(path.join(legacyCacheDir, "deps.json"), "{}", "utf8");
      mkdirSync(path.join(staleLegacySlotDir, "component"), { recursive: true });
      writeFileSync(path.join(staleLegacySlotDir, "component", "View.tsx"), PLACEHOLDER, "utf8");
      mkdirSync(staleLegacyCacheDir, { recursive: true });
      writeFileSync(path.join(staleLegacyCacheDir, "deps.json"), "{}", "utf8");
      mkdirSync(orphanCacheDir, { recursive: true });
      writeFileSync(path.join(orphanCacheDir, "deps.json"), "{}", "utf8");
      mkdirSync(unmanagedCacheDir, { recursive: true });
      writeFileSync(path.join(unmanagedCacheDir, "keep.txt"), "keep", "utf8");
      mkdirSync(lookalikeCacheDir, { recursive: true });
      writeFileSync(path.join(lookalikeCacheDir, "keep.txt"), "keep", "utf8");
      mkdirSync(path.join(siblingWorkspaceSlotDir, "component"), { recursive: true });
      writeFileSync(
        path.join(siblingWorkspaceSlotDir, "component", "View.tsx"),
        PLACEHOLDER,
        "utf8",
      );
      mkdirSync(siblingWorkspaceCacheDir, { recursive: true });
      writeFileSync(path.join(siblingWorkspaceCacheDir, "deps.json"), "{}", "utf8");

      const staleLegacyTime = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      utimesSync(staleLegacySlotDir, staleLegacyTime, staleLegacyTime);

      clearRuntimeArtifacts();

      assert.equal(existsSync(managedSlotDir), true);
      assert.equal(existsSync(managedCacheDir), true);
      assert.equal(existsSync(staleSlotDir), false);
      assert.equal(existsSync(staleCacheDir), false);
      assert.equal(existsSync(legacySlotDir), true);
      assert.equal(existsSync(legacyCacheDir), true);
      assert.equal(existsSync(staleLegacySlotDir), false);
      assert.equal(existsSync(staleLegacyCacheDir), false);
      assert.equal(existsSync(orphanCacheDir), false);
      assert.equal(existsSync(unmanagedCacheDir), true);
      assert.equal(existsSync(lookalikeCacheDir), true);
      assert.equal(existsSync(siblingWorkspaceSlotDir), true);
      assert.equal(existsSync(siblingWorkspaceCacheDir), true);
    });
  } finally {
    rmSync(runtimeSlotsBase, { recursive: true, force: true });
  }
});

test("waitForCloseOperation waits for close completion but caps hanging shutdowns", async () => {
  let closed = false;
  await waitForCloseOperation(
    new Promise((resolve) => {
      setTimeout(() => {
        closed = true;
        resolve(undefined);
      }, 10);
    }),
    100,
  );
  assert.equal(closed, true);

  const start = Date.now();
  await waitForCloseOperation(new Promise(() => {}), 10);
  const elapsedMs = Date.now() - start;

  assert.ok(elapsedMs >= 10);
  assert.ok(elapsedMs < 200);
});

test("createQueuedArtifactReload coalesces save bursts and cancels pending reloads", async () => {
  let reloadCount = 0;
  const queueReload = createQueuedArtifactReload(() => {
    reloadCount += 1;
  }, setTimeout, clearTimeout, 10);

  queueReload();
  queueReload();
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(reloadCount, 1);

  queueReload();
  queueReload.dispose();
  await new Promise((resolve) => setTimeout(resolve, 30));

  assert.equal(reloadCount, 1);
});

test("parseCliArgs returns the documented default workflow", () => {
  assert.deepEqual(parseCliArgs([]), {
    mode: "run",
    inputFile: null,
    port: DEFAULT_VIEWER_PORT,
    wsPort: getWebSocketPort(DEFAULT_VIEWER_PORT),
  });
});

test("parseCliArgs accepts the highest viewer port that leaves room for the WebSocket port", () => {
  assert.deepEqual(parseCliArgs(["--port", String(MAX_VIEWER_PORT)]), {
    mode: "run",
    inputFile: null,
    port: MAX_VIEWER_PORT,
    wsPort: getWebSocketPort(MAX_VIEWER_PORT),
  });
});

for (const [name, args, message] of [
  [
    "parseCliArgs rejects unknown options loudly",
    ["--wat"],
    'Unknown option "--wat". Run with "--help" for usage.',
  ],
  [
    "parseCliArgs rejects duplicate port flags",
    ["--port", "8080", "-p", "9090"],
    "--port can only be provided once.",
  ],
  [
    "parseCliArgs rejects multiple positional files",
    ["one.tsx", "two.tsx"],
    "Received multiple input files. Pass zero or one .jsx/.tsx file.",
  ],
  [
    "parseCliArgs rejects unsupported file extensions",
    ["artifact.js"],
    `Unsupported input file "artifact.js". Pass a ${SUPPORTED_INPUT_EXTENSIONS.join(" or ")} file.`,
  ],
  [
    "parseCliArgs rejects viewer ports that overflow the WebSocket port range",
    ["--port", String(MAX_VIEWER_PORT + 1)],
    `Invalid value for --port: "${MAX_VIEWER_PORT + 1}". Expected an integer between 1 and ${MAX_VIEWER_PORT} so the WebSocket can listen on port + ${WEB_SOCKET_PORT_OFFSET}.`,
  ],
]) {
  test(name, () => {
    assert.throws(() => parseCliArgs(args), new CliUsageError(message));
  });
}

test("cli surfaces usage errors without silently falling back to another workflow", () => {
  const result = runCli(["--wat"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option "--wat"/);
  assert.match(result.stderr, /--help/);
  assert.equal(result.stdout, "");
});

test("cli rejects ports that would overflow the WebSocket listener before runtime startup", () => {
  const invalidPort = String(MAX_VIEWER_PORT + 1);
  const result = runCli(["--port", invalidPort]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, new RegExp(`Invalid value for --port: "${invalidPort}"`));
  assert.doesNotMatch(result.stderr, /Failed to start/);
  assert.equal(result.stdout, "");
});

test("startup failures clear the runtime slot without touching the tracked placeholder", async () => {
  const originalTrackedSlot = readSlot();
  const runtimeSlotsDir = mkdtempSync(path.join(os.tmpdir(), "jsx-viewer-runtime-"));
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "jsx-viewer-cli-"));
  const fixturePath = path.join(tempDir, "Fixture.tsx");
  writeFileSync(
    fixturePath,
    "export default function Fixture() { return <div>fixture</div>; }\n",
    "utf8",
  );

  const blocker = createServer();

  try {
    resetSlot();

    await new Promise((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, resolve);
    });

    const address = blocker.address();
    assert.notEqual(address, null);
    assert.equal(typeof address, "object");

    const result = runCli(["--port", String(address.port), fixturePath], {
      env: {
        [RUNTIME_SLOTS_ENV]: runtimeSlotsDir,
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Failed to start:/);
    assert.equal(readSlot(), PLACEHOLDER);
    withRuntimeSlotsDir(runtimeSlotsDir, () => {
      assert.equal(readSlot(getRuntimeSlotPath(address.port)), null);
    });
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
    rmSync(runtimeSlotsDir, { recursive: true, force: true });
    rmSync(tempDir, { recursive: true, force: true });
    if (originalTrackedSlot === null) {
      resetSlot();
    } else {
      writeSlot(originalTrackedSlot);
    }
  }
});

test("WebSocket port conflicts leave the tracked placeholder untouched", async () => {
  const originalTrackedSlot = readSlot();
  const runtimeSlotsDir = mkdtempSync(path.join(os.tmpdir(), "jsx-viewer-runtime-"));
  const blocker = createServer();
  const dirtyTrackedSlot =
    "export default function Dirty() { return <div>dirty</div>; }\n";

  try {
    writeSlot(dirtyTrackedSlot);

    await new Promise((resolve, reject) => {
      blocker.once("error", reject);
      blocker.listen(0, resolve);
    });

    const address = blocker.address();
    assert.notEqual(address, null);
    assert.equal(typeof address, "object");

    const viewerPort = address.port - WEB_SOCKET_PORT_OFFSET;
    assert.ok(viewerPort > 0);

    const result = runCli(["--port", String(viewerPort)], {
      env: {
        [RUNTIME_SLOTS_ENV]: runtimeSlotsDir,
      },
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Failed to start:/);
    assert.equal(readSlot(), dirtyTrackedSlot);
    withRuntimeSlotsDir(runtimeSlotsDir, () => {
      assert.equal(readSlot(getRuntimeSlotPath(viewerPort)), null);
    });
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
    rmSync(runtimeSlotsDir, { recursive: true, force: true });
    if (originalTrackedSlot === null) {
      resetSlot();
    } else {
      writeSlot(originalTrackedSlot);
    }
  }
});

test("npm pack only ships runtime package files", () => {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--silent"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    shell: true,
  });

  assert.equal(result.status, 0);
  const stdout = result.stdout;

  const [{ files }] = JSON.parse(stdout);
  const packedPaths = files.map((entry) => entry.path);
  const requiredBrowserPackFiles = [
    "src/browser/basePath.ts",
    "src/browser/browserRuntimeContext.ts",
    "src/browser/runtimeUrl.ts",
  ];
  const requiredExamplePackFiles = [
    "example/Dashboard.tsx",
    "example/DataTable.jsx",
    "example/PolyField.tsx",
  ];

  assert.equal(packedPaths.some((entry) => entry.includes(".test.")), false);
  assert.equal(packedPaths.includes(".githooks/pre-commit"), false);
  assert.equal(packedPaths.includes("eslint.config.ts"), false);
  assert.equal(packedPaths.includes("shared/runtime-config.json"), true);
  assert.equal(packedPaths.includes("bin/jsx-viewer-cli.mjs"), true);
  assert.equal(packedPaths.includes("bin/jsx-viewer.mjs"), true);
  assert.equal(packedPaths.includes("bin/jsx-viewer-runtime.mjs"), true);
  assert.equal(packedPaths.includes("src/App.tsx"), true);
  assert.deepEqual(
    requiredBrowserPackFiles.filter((entry) => packedPaths.includes(entry)),
    requiredBrowserPackFiles,
  );
  assert.deepEqual(
    requiredExamplePackFiles.filter((entry) => packedPaths.includes(entry)),
    requiredExamplePackFiles,
  );
  assert.equal(packedPaths.includes("src/browser/devEntryUrl.ts"), true);
  assert.equal(packedPaths.includes("src/hotReload.ts"), true);
});

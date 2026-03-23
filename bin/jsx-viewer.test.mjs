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
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  CliUsageError,
  DEFAULT_VIEWER_PORT,
  SUPPORTED_INPUT_EXTENSIONS,
  WEB_SOCKET_PORT_OFFSET,
  getHelpText,
  getWebSocketPort,
  parseCliArgs,
} from "./jsx-viewer-cli.mjs";
import {
  PLACEHOLDER,
  TRACKED_SLOT_PATH,
  getRuntimeSlotModuleUrl,
  getRuntimeSlotPath,
  readSlot,
  resetSlot,
  writeSlot,
} from "./slot.mjs";

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

test("cli entrypoint does not depend on the tsx loader", () => {
  assert.doesNotMatch(cliEntrypoint, /tsx\/esm\/api/);
  assert.doesNotMatch(cliEntrypoint, /jsx-viewer\.ts/);
  assert.doesNotMatch(cliEntrypoint, /from "vite"/);
  assert.doesNotMatch(cliEntrypoint, /from "ws"/);
  assert.match(cliEntrypoint, /await import\("\.\/jsx-viewer-runtime\.mjs"\)/);
  assert.equal(existsSync(new URL("./jsx-viewer.ts", import.meta.url)), false);
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

test("help text documents the actual default port behavior", () => {
  const helpText = getHelpText();
  assert.match(helpText, new RegExp(`default: ${DEFAULT_VIEWER_PORT}`));
  assert.match(helpText, new RegExp(`port \\+ ${WEB_SOCKET_PORT_OFFSET}`));
  assert.match(helpText, /Pass zero or one \.jsx\/\.tsx file\./);
});

test("runtime slots live outside the tracked package tree", () => {
  const runtimeSlotsDir = mkdtempSync(path.join(os.tmpdir(), "jsx-viewer-slots-"));

  try {
    withRuntimeSlotsDir(runtimeSlotsDir, () => {
      const runtimeSlotPath = getRuntimeSlotPath(DEFAULT_VIEWER_PORT);
      const runtimeSlotUrl = getRuntimeSlotModuleUrl(DEFAULT_VIEWER_PORT);

      assert.equal(path.relative(REPO_ROOT, runtimeSlotPath).startsWith(".."), true);
      assert.equal(path.normalize(TRACKED_SLOT_PATH), path.join(REPO_ROOT, "component", "View.tsx"));
      assert.match(runtimeSlotUrl, /^\/@fs\//);
      assert.match(runtimeSlotUrl.replace(/\\/g, "/"), /\/component\/View\.tsx$/);
    });
  } finally {
    rmSync(runtimeSlotsDir, { recursive: true, force: true });
  }
});

test("parseCliArgs returns the documented default workflow", () => {
  assert.deepEqual(parseCliArgs([]), {
    mode: "run",
    inputFile: null,
    port: DEFAULT_VIEWER_PORT,
    wsPort: getWebSocketPort(DEFAULT_VIEWER_PORT),
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

  assert.equal(packedPaths.some((entry) => entry.includes(".test.")), false);
  assert.equal(packedPaths.includes(".githooks/pre-commit"), false);
  assert.equal(packedPaths.includes("eslint.config.ts"), false);
  assert.equal(packedPaths.includes("shared/runtime-config.json"), true);
  assert.equal(packedPaths.includes("bin/jsx-viewer-cli.mjs"), true);
  assert.equal(packedPaths.includes("bin/jsx-viewer.mjs"), true);
  assert.equal(packedPaths.includes("bin/jsx-viewer-runtime.mjs"), true);
  assert.equal(packedPaths.includes("src/App.tsx"), true);
});

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
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
import { PLACEHOLDER, readSlot, resetSlot, writeSlot } from "./slot.mjs";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CLI_PATH = fileURLToPath(new URL("./jsx-viewer.mjs", import.meta.url));
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const cliEntrypoint = readFileSync(
  new URL("./jsx-viewer.mjs", import.meta.url),
  "utf8",
);

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: "1",
      ...options.env,
    },
  });
}

test("cli entrypoint does not depend on the tsx loader", () => {
  assert.doesNotMatch(cliEntrypoint, /tsx\/esm\/api/);
  assert.doesNotMatch(cliEntrypoint, /jsx-viewer\.ts/);
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

test("parseCliArgs returns the documented default workflow", () => {
  assert.deepEqual(parseCliArgs([]), {
    mode: "run",
    inputFile: null,
    port: DEFAULT_VIEWER_PORT,
    wsPort: getWebSocketPort(DEFAULT_VIEWER_PORT),
  });
});

test("parseCliArgs rejects unknown options loudly", () => {
  assert.throws(
    () => parseCliArgs(["--wat"]),
    new CliUsageError('Unknown option "--wat". Run with "--help" for usage.'),
  );
});

test("parseCliArgs rejects duplicate port flags", () => {
  assert.throws(
    () => parseCliArgs(["--port", "8080", "-p", "9090"]),
    new CliUsageError("--port can only be provided once."),
  );
});

test("parseCliArgs rejects multiple positional files", () => {
  assert.throws(
    () => parseCliArgs(["one.tsx", "two.tsx"]),
    new CliUsageError(
      "Received multiple input files. Pass zero or one .jsx/.tsx file.",
    ),
  );
});

test("parseCliArgs rejects unsupported file extensions", () => {
  assert.throws(
    () => parseCliArgs(["artifact.js"]),
    new CliUsageError(
      `Unsupported input file "artifact.js". Pass a ${SUPPORTED_INPUT_EXTENSIONS.join(" or ")} file.`,
    ),
  );
});

test("cli surfaces usage errors without silently falling back to another workflow", () => {
  const result = runCli(["--wat"]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unknown option "--wat"/);
  assert.match(result.stderr, /--help/);
  assert.equal(result.stdout, "");
});

test("startup failures roll the transient slot back to the placeholder", async () => {
  const originalSlot = readSlot();
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

    const result = runCli(["--port", String(address.port), fixturePath]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Failed to start:/);
    assert.equal(readSlot(), PLACEHOLDER);
  } finally {
    await new Promise((resolve) => blocker.close(resolve));
    if (originalSlot === null) {
      resetSlot();
    } else {
      writeSlot(originalSlot);
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
  assert.equal(packedPaths.includes("src/App.tsx"), true);
});

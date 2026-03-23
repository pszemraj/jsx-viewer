import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
const CLI_PATH = fileURLToPath(new URL("./jsx-viewer.mjs", import.meta.url));
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const cliEntrypoint = readFileSync(
  new URL("./jsx-viewer.mjs", import.meta.url),
  "utf8",
);

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

test("npm pack only ships runtime package files", () => {
  assert.equal(typeof process.env.npm_execpath, "string");
  const stdout = execFileSync(
    process.execPath,
    [process.env.npm_execpath, "pack", "--dry-run", "--json", "--silent"],
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
    },
  );

  const [{ files }] = JSON.parse(stdout);
  const packedPaths = files.map((entry) => entry.path);

  assert.equal(packedPaths.some((entry) => entry.includes(".test.")), false);
  assert.equal(packedPaths.includes(".githooks/pre-commit"), false);
  assert.equal(packedPaths.includes("eslint.config.ts"), false);
  assert.equal(packedPaths.includes("bin/jsx-viewer.mjs"), true);
  assert.equal(packedPaths.includes("src/App.tsx"), true);
});

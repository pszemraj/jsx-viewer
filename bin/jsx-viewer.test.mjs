import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

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

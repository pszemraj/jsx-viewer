import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const distDir = path.resolve(process.cwd(), "dist-browser");
const sourceHtml = path.join(distDir, "index.browser.html");
const targetHtml = path.join(distDir, "index.html");

if (!existsSync(sourceHtml)) {
  throw new Error(`Expected browser entry at ${sourceHtml}, but it was not found.`);
}

if (existsSync(targetHtml)) {
  throw new Error(`Refusing to overwrite existing ${targetHtml}.`);
}

renameSync(sourceHtml, targetHtml);
writeFileSync(path.join(distDir, ".nojekyll"), "");

async function assertNamedExports(relativePath, expectedExports) {
  const moduleUrl = pathToFileURL(path.join(distDir, relativePath)).href;
  const mod = await import(moduleUrl);

  for (const exportName of expectedExports) {
    if (!(exportName in mod)) {
      throw new Error(
        `Expected ${relativePath} to export "${exportName}", but it did not.`,
      );
    }
  }
}

function assertTextIncludes(filePath, expectedText) {
  const contents = readFileSync(filePath, "utf8");

  if (!contents.includes(expectedText)) {
    throw new Error(
      `Expected ${path.basename(filePath)} to include "${expectedText}", but it did not.`,
    );
  }
}

await assertNamedExports("runtime/react-jsx-runtime.js", [
  "Fragment",
  "jsx",
  "jsxs",
]);
await assertNamedExports("runtime/react-jsx-dev-runtime.js", [
  "Fragment",
  "jsxDEV",
]);
await assertNamedExports("runtime/react-dom.js", [
  "createPortal",
  "flushSync",
]);
await assertNamedExports("runtime/react-dom-client.js", [
  "createRoot",
  "hydrateRoot",
]);
await assertNamedExports("runtime/papaparse.js", [
  "parse",
  "unparse",
  "BAD_DELIMITERS",
]);
assertTextIncludes(targetHtml, 'http-equiv="Content-Security-Policy"');
assertTextIncludes(targetHtml, "script-src &#39;self&#39; blob:");

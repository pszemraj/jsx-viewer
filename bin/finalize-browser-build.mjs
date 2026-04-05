import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const distDir = path.resolve(process.cwd(), "dist-browser");
const sourceHtml = path.join(distDir, "index.browser.html");
const targetHtml = path.join(distDir, "index.html");
const previewFrameHtml = path.join(distDir, "preview-frame.html");
const normalizedBasePath = normalizeBrowserBasePath(process.env.VITE_BASE_PATH);

if (!existsSync(sourceHtml)) {
  throw new Error(`Expected browser entry at ${sourceHtml}, but it was not found.`);
}

if (existsSync(targetHtml)) {
  throw new Error(`Refusing to overwrite existing ${targetHtml}.`);
}

if (!existsSync(previewFrameHtml)) {
  throw new Error(`Expected preview frame entry at ${previewFrameHtml}, but it was not found.`);
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

function normalizeBrowserBasePath(basePath) {
  if (!basePath) {
    return "/";
  }

  const trimmed = basePath.trim();
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

function computeInlineScriptHash(contents) {
  return createHash("sha256").update(contents, "utf8").digest("base64");
}

function extractPreviewImportMapContents(filePath) {
  const contents = readFileSync(filePath, "utf8");
  const match = contents.match(/<script type="importmap">([\s\S]*?)<\/script>/);

  if (!match) {
    throw new Error(
      `Expected ${path.basename(filePath)} to include an inline import map script.`,
    );
  }

  return match[1];
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
assertTextIncludes(targetHtml, 'http-equiv="Content-Security-Policy"');
assertTextIncludes(targetHtml, "script-src &#39;self&#39; blob: https://esm.sh https://cdn.tailwindcss.com");
assertTextIncludes(targetHtml, "connect-src &#39;self&#39; https: wss:");
assertTextIncludes(targetHtml, "img-src &#39;self&#39; https: blob: data:");
assertTextIncludes(previewFrameHtml, 'http-equiv="Content-Security-Policy"');
assertTextIncludes(previewFrameHtml, "script-src &#39;self&#39; blob: https://esm.sh https://cdn.tailwindcss.com");
assertTextIncludes(previewFrameHtml, "connect-src &#39;self&#39; https: wss:");
assertTextIncludes(previewFrameHtml, "img-src &#39;self&#39; https: blob: data:");
assertTextIncludes(previewFrameHtml, '<script type="importmap">');
assertTextIncludes(
  previewFrameHtml,
  `"react-dom/client": "${normalizedBasePath}runtime/react-dom-client.js"`,
);
assertTextIncludes(
  previewFrameHtml,
  `sha256-${computeInlineScriptHash(extractPreviewImportMapContents(previewFrameHtml))}`,
);

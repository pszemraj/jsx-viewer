import assert from "node:assert/strict";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

const distDir = path.resolve(process.cwd(), "dist-browser");
const sourceHtml = path.join(distDir, "index.browser.html");
const targetHtml = path.join(distDir, "index.html");
const previewFrameHtml = path.join(distDir, "preview-frame.html");

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

function readUtf8(filePath) {
  return readFileSync(filePath, "utf8");
}

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

function computeInlineScriptHash(contents) {
  return createHash("sha256").update(contents, "utf8").digest("base64");
}

function extractPreviewImportMapContents(filePath) {
  const contents = readUtf8(filePath);
  const match = contents.match(/<script type="importmap">([\s\S]*?)<\/script>/);

  if (!match) {
    throw new Error(
      `Expected ${path.basename(filePath)} to include an inline import map script.`,
    );
  }

  return match[1];
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractAttribute(tag, attributeName) {
  const match = tag.match(new RegExp(`\\s${attributeName}="([^"]*)"`, "iu"));
  return match ? decodeHtmlAttribute(match[1]) : null;
}

function extractContentSecurityPolicy(filePath) {
  const contents = readUtf8(filePath);
  const metaTags = contents.match(/<meta\b[^>]*>/giu) ?? [];

  for (const tag of metaTags) {
    if (extractAttribute(tag, "http-equiv") === "Content-Security-Policy") {
      const content = extractAttribute(tag, "content");
      assert.ok(content, `Expected ${path.basename(filePath)} CSP meta to include content.`);
      return content;
    }
  }

  throw new Error(`Expected ${path.basename(filePath)} to include a CSP meta tag.`);
}

function getCspDirective(csp, name) {
  const directive = csp
    .split("; ")
    .find((candidate) => candidate.startsWith(`${name} `));

  assert.ok(directive, `Expected CSP to include ${name}.`);
  return directive;
}

function assertBrowserCsp(filePath, options = {}) {
  const csp = extractContentSecurityPolicy(filePath);
  const scriptHashSuffix = options.inlineScriptHash
    ? ` '${options.inlineScriptHash}'`
    : "";

  assert.equal(
    getCspDirective(csp, "script-src"),
    `script-src 'self' blob: https://esm.sh https://cdn.tailwindcss.com${scriptHashSuffix}`,
  );
  assert.equal(getCspDirective(csp, "connect-src"), "connect-src 'self' https: wss:");
  assert.equal(getCspDirective(csp, "img-src"), "img-src 'self' https: blob: data:");
  assert.equal(
    getCspDirective(csp, "style-src"),
    "style-src 'self' 'unsafe-inline' https: blob:",
  );
  assert.equal(
    getCspDirective(csp, "font-src"),
    "font-src 'self' https: blob: data:",
  );
  assert.equal(
    getCspDirective(csp, "media-src"),
    "media-src 'self' https: blob: data:",
  );
  assert.equal(getCspDirective(csp, "frame-src"), "frame-src 'self' https:");
  assert.equal(getCspDirective(csp, "worker-src"), "worker-src 'self' blob:");
}

function assertPreviewImportMap(filePath) {
  const importMapContents = extractPreviewImportMapContents(filePath);
  const importMap = JSON.parse(importMapContents);
  const reactDomClientUrl = importMap.imports?.["react-dom/client"];

  assert.equal(typeof reactDomClientUrl, "string");
  assert.equal(reactDomClientUrl.startsWith("/"), true);
  assert.equal(reactDomClientUrl.endsWith("runtime/react-dom-client.js"), true);

  return importMapContents;
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

const previewImportMapContents = assertPreviewImportMap(previewFrameHtml);
assertBrowserCsp(targetHtml);
assertBrowserCsp(previewFrameHtml, {
  inlineScriptHash: `sha256-${computeInlineScriptHash(previewImportMapContents)}`,
});

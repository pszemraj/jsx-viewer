import assert from "node:assert/strict";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildBrowserContentSecurityPolicy,
  computeInlineScriptHash,
} from "../shared/browser-csp.mjs";

const distDir = path.resolve(process.cwd(), "dist-browser");
const sourceHtml = path.join(distDir, "index.browser.html");
const targetHtml = path.join(distDir, "index.html");
const previewFrameHtml = path.join(distDir, "preview-frame.html");

/**
 * @typedef {{ readonly inlineScriptHash?: string }} BrowserCspAssertOptions
 */

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

/**
 * @param {string} filePath
 * @returns {string}
 */
function readUtf8(filePath) {
  return readFileSync(filePath, "utf8");
}

/**
 * @param {string} relativePath
 * @param {readonly string[]} expectedExports
 * @returns {Promise<void>}
 */
async function assertNamedExports(relativePath, expectedExports) {
  const moduleUrl = pathToFileURL(path.join(distDir, relativePath)).href;
  const mod = /** @type {Record<string, unknown>} */ (await import(moduleUrl));

  for (const exportName of expectedExports) {
    if (!(exportName in mod)) {
      throw new Error(
        `Expected ${relativePath} to export "${exportName}", but it did not.`,
      );
    }
  }
}

/**
 * @param {string} filePath
 * @returns {string}
 */
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

/**
 * @param {string} value
 * @returns {string}
 */
function decodeHtmlAttribute(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * @param {string} tag
 * @param {string} attributeName
 * @returns {string | null}
 */
function extractAttribute(tag, attributeName) {
  const match = tag.match(new RegExp(`\\s${attributeName}="([^"]*)"`, "iu"));
  return match ? decodeHtmlAttribute(match[1]) : null;
}

/**
 * @param {string} filePath
 * @returns {string}
 */
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

/**
 * @param {string} filePath
 * @param {BrowserCspAssertOptions} [options]
 * @returns {void}
 */
function assertBrowserCsp(filePath, options = {}) {
  const csp = extractContentSecurityPolicy(filePath);
  const expectedCsp = buildBrowserContentSecurityPolicy({
    inlineScriptHashes: options.inlineScriptHash ? [options.inlineScriptHash] : [],
  });

  assert.equal(csp, expectedCsp);
}

/**
 * @param {string} filePath
 * @returns {string}
 */
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
  inlineScriptHash: computeInlineScriptHash(previewImportMapContents),
});

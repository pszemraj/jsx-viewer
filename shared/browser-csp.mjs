import { createHash } from "node:crypto";

/**
 * @typedef {{ readonly inlineScriptHashes?: readonly string[] }} BrowserContentSecurityPolicyOptions
 */

/** @type {Record<string, readonly string[]>} */
export const BROWSER_CSP_DIRECTIVES = {
  "default-src": ["'self'"],
  "script-src": [
    "'self'",
    "blob:",
    "https://esm.sh",
    "https://cdn.tailwindcss.com",
  ],
  "connect-src": ["'self'", "https:", "wss:"],
  "img-src": ["'self'", "https:", "blob:", "data:"],
  "style-src": ["'self'", "'unsafe-inline'", "https:", "blob:"],
  "font-src": ["'self'", "https:", "blob:", "data:"],
  "media-src": ["'self'", "https:", "blob:", "data:"],
  "frame-src": ["'self'", "https:"],
  "worker-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
  "upgrade-insecure-requests": [],
};

/**
 * @param {string} contents
 * @returns {string}
 */
export function computeInlineScriptHash(contents) {
  return `sha256-${createHash("sha256").update(contents, "utf8").digest("base64")}`;
}

/**
 * @param {BrowserContentSecurityPolicyOptions} [options]
 * @returns {string}
 */
export function buildBrowserContentSecurityPolicy(options = {}) {
  const inlineScriptHashes = options.inlineScriptHashes ?? [];
  const directives = {
    ...BROWSER_CSP_DIRECTIVES,
    "script-src": [
      ...BROWSER_CSP_DIRECTIVES["script-src"],
      ...inlineScriptHashes.map((hash) => `'${hash}'`),
    ],
  };

  return Object.entries(directives)
    .map(([name, sources]) =>
      sources.length > 0 ? `${name} ${sources.join(" ")}` : name,
    )
    .join("; ");
}

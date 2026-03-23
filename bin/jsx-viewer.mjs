#!/usr/bin/env node

import { assertSupportedNodeVersion } from "./node-version.mjs";

try {
  assertSupportedNodeVersion(process.versions.node);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\x1b[31m${message}\x1b[0m`);
  process.exit(1);
}

const { main } = await import("./jsx-viewer-runtime.mjs");

await main();

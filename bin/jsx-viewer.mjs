#!/usr/bin/env node

import fs from "node:fs";
import {
  CliUsageError,
  getHelpText,
  parseCliArgs,
} from "./jsx-viewer-cli.mjs";
import { assertSupportedNodeVersion } from "./node-version.mjs";

function readPackageVersion() {
  const { version } = JSON.parse(
    fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  return version;
}

async function run() {
  try {
    assertSupportedNodeVersion(process.versions.node);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\x1b[31m${message}\x1b[0m`);
    process.exit(1);
  }

  let cliArgs;

  try {
    cliArgs = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CliUsageError) {
      console.error(`\x1b[31m[jsx-viewer]\x1b[0m ${error.message}`);
      process.exit(1);
    }

    throw error;
  }

  if (cliArgs.mode === "help") {
    console.log(getHelpText());
    return;
  }

  if (cliArgs.mode === "version") {
    console.log(readPackageVersion());
    return;
  }

  const { main } = await import("./jsx-viewer-runtime.mjs");
  await main(cliArgs);
}

await run();

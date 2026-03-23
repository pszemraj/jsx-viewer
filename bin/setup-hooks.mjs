#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOKS_PATH = ".githooks";
const HOOKS_ENV = "JSX_VIEWER_ENABLE_GIT_HOOKS";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRE_COMMIT_HOOK = path.resolve(__dirname, "..", HOOKS_PATH, "pre-commit");

function getLocalHooksPath() {
  try {
    return execFileSync("git", ["config", "--local", "--get", "core.hooksPath"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function unsetLocalHooksPath() {
  if (getLocalHooksPath() !== HOOKS_PATH) {
    return;
  }

  execFileSync("git", ["config", "--local", "--unset", "core.hooksPath"], {
    stdio: "ignore",
  });
}

try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
    stdio: "ignore",
  });

  if (!fs.existsSync(PRE_COMMIT_HOOK)) {
    unsetLocalHooksPath();
    process.exit(0);
  }

  const shouldEnableHooks =
    process.platform !== "win32" || process.env[HOOKS_ENV] === "1";

  if (!shouldEnableHooks) {
    unsetLocalHooksPath();
    process.exit(0);
  }

  execFileSync("git", ["config", "--local", "core.hooksPath", HOOKS_PATH], {
    stdio: "ignore",
  });
} catch {
  // Ignore setup failures outside a git checkout.
}

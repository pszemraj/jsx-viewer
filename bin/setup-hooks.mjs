#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const HOOKS_PATH = ".githooks";
const HOOKS_ENV = "JSX_VIEWER_ENABLE_GIT_HOOKS";

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

try {
  execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
    stdio: "ignore",
  });

  const shouldEnableHooks =
    process.platform !== "win32" || process.env[HOOKS_ENV] === "1";

  if (!shouldEnableHooks) {
    if (getLocalHooksPath() === HOOKS_PATH) {
      execFileSync("git", ["config", "--local", "--unset", "core.hooksPath"], {
        stdio: "ignore",
      });
    }
    process.exit(0);
  }

  execFileSync("git", ["config", "--local", "core.hooksPath", HOOKS_PATH], {
    stdio: "ignore",
  });
} catch {
  // Ignore setup failures outside a git checkout.
}

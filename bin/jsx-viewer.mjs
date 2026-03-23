#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { watch } from "chokidar";
import { createServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";
import {
  CliUsageError,
  getHelpText,
  parseCliArgs,
} from "./jsx-viewer-cli.mjs";
import { isClientMessage } from "../shared/protocol.mjs";
import { assertSupportedNodeVersion } from "./node-version.mjs";
import { ROOT, resetSlot, writeSlot } from "./slot.mjs";

try {
  assertSupportedNodeVersion(process.versions.node);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\x1b[31m${message}\x1b[0m`);
  process.exit(1);
}

const { version: VERSION } = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

function loadFileIntoSlot(filePath) {
  let stats;

  try {
    stats = fs.statSync(filePath);
  } catch {
    throw new Error(`File not found: ${filePath}`);
  }

  if (!stats.isFile()) {
    throw new Error(`Input path is not a file: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  writeSlot(content);
  return path.basename(filePath);
}

function toError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

let currentFilename = null;
let watcher = null;
let server = null;
let wss = null;
let slotWasTouched = false;

function broadcast(message) {
  if (!wss) {
    return;
  }

  const serialized = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(serialized);
    }
  });
}

function stopWatching() {
  if (watcher) {
    void watcher.close();
    watcher = null;
  }
}

function startWatching(filePath) {
  stopWatching();
  watcher = watch(filePath, { ignoreInitial: true });
  watcher.on("change", () => {
    try {
      currentFilename = loadFileIntoSlot(filePath);
      broadcast({ type: "file-updated", filename: currentFilename });
      console.log("\x1b[36m[jsx-viewer]\x1b[0m File changed, reloading...");
    } catch (error) {
      console.error(
        "\x1b[31m[jsx-viewer]\x1b[0m Failed to reload watched file:",
        toError(error).message,
      );
    }
  });
}

let cleaningUp = false;

function cleanup(exitCode = 0) {
  if (cleaningUp) {
    return;
  }

  cleaningUp = true;

  if (slotWasTouched) {
    try {
      resetSlot();
    } catch (error) {
      console.error("[jsx-viewer] Failed to reset slot:", toError(error).message);
    }
  }

  try {
    stopWatching();
  } catch {
    // Ignore watcher shutdown failures.
  }

  try {
    wss?.close();
  } catch {
    // Ignore WebSocket shutdown failures.
  }

  try {
    void server?.close();
  } catch {
    // Ignore Vite shutdown failures.
  }

  process.exit(exitCode);
}

function registerWebSocketHandlers() {
  wss.on("connection", (ws) => {
    ws.send(
      JSON.stringify({
        type: "file-updated",
        filename: currentFilename,
      }),
    );

    ws.on("message", (raw) => {
      try {
        const message = JSON.parse(raw.toString());
        if (!isClientMessage(message)) {
          throw new Error("Unsupported WebSocket payload.");
        }

        if (message.type === "reset-slot") {
          stopWatching();
          resetSlot();
          currentFilename = null;
          broadcast({ type: "file-updated", filename: null });
          return;
        }

        stopWatching();
        writeSlot(message.content);
        currentFilename = message.filename || "pasted.tsx";
        broadcast({ type: "file-updated", filename: currentFilename });
      } catch (error) {
        console.error(
          "\x1b[31m[jsx-viewer]\x1b[0m Bad WebSocket message:",
          toError(error).message,
        );
      }
    });
  });
}

async function main() {
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
    console.log(VERSION);
    return;
  }

  const { inputFile, port, wsPort } = cliArgs;

  try {
    wss = new WebSocketServer({ port: wsPort });
    registerWebSocketHandlers();

    if (inputFile) {
      currentFilename = loadFileIntoSlot(inputFile);
      slotWasTouched = true;
      startWatching(inputFile);
    } else {
      resetSlot();
      slotWasTouched = true;
    }

    server = await createServer({
      root: ROOT,
      configFile: path.join(ROOT, "vite.config.ts"),
      define: {
        __JSX_VIEWER_WS_PORT__: JSON.stringify(String(wsPort)),
      },
      server: {
        port,
        open: !process.env.CI,
        strictPort: true,
      },
    });

    await server.listen();

    console.log();
    console.log(`  \x1b[1m\x1b[36mjsx-viewer\x1b[0m \x1b[2mv${VERSION}\x1b[0m`);
    console.log();
    console.log(
      `  \x1b[2m→\x1b[0m Viewer:    \x1b[36mhttp://localhost:${port}\x1b[0m`,
    );
    console.log(
      `  \x1b[2m→\x1b[0m WebSocket: \x1b[2mws://localhost:${wsPort}\x1b[0m`,
    );
    if (inputFile) {
      console.log(`  \x1b[2m→\x1b[0m Watching:  \x1b[33m${inputFile}\x1b[0m`);
    }
    console.log();
    if (inputFile) {
      console.log(
        '  \x1b[2mUse "swap file" in the browser or save the watched file to reload.\x1b[0m',
      );
    } else {
      console.log(
        "  \x1b[2mDrop a .jsx/.tsx file in the browser, press Ctrl/Cmd+V to paste, or pass a file via CLI.\x1b[0m",
      );
    }
    console.log();

    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);
  } catch (error) {
    console.error(
      "\x1b[31m[jsx-viewer]\x1b[0m Failed to start:",
      toError(error).message,
    );
    cleanup(1);
  }
}

await main();

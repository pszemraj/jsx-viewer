#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { watch, type FSWatcher } from "chokidar";
import {
  WebSocket,
  WebSocketServer,
  type RawData,
  type WebSocket as WsClient,
} from "ws";
import {
  isClientMessage,
  type FileUpdatedMessage,
} from "../shared/protocol";
import { ROOT, resetSlot, writeSlot } from "./slot.mjs";

const VERSION = "1.0.0";

interface ParsedArgs {
  inputFile: string | null;
  port: number;
  wsPort: number;
}

function printHelp() {
  console.log(`
  jsx-viewer - render .jsx/.tsx files like .html

  Usage:
    node bin/jsx-viewer.mjs [options] [file.tsx]

  After global install/link:
    jsx-viewer [options] [file.tsx]

  Options:
    -p, --port <n>   Dev server port (default: 3142)
    -h, --help       Show this help

  Examples:
    node bin/jsx-viewer.mjs                     # Start with the empty drop/upload/paste UI
    node bin/jsx-viewer.mjs dashboard.tsx       # Start with a file already loaded and watched
    node bin/jsx-viewer.mjs -p 8080 app.jsx     # Custom port with a preloaded file
`);
}

function parseArgs(args: string[]): ParsedArgs {
  let inputFile: string | null = null;
  let port = 3142;
  let wsPort = 3143;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--port" || arg === "-p") {
      const next = args[index + 1];
      const parsedPort = Number.parseInt(next ?? "", 10);
      if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
        console.error("\x1b[31m[jsx-viewer]\x1b[0m Invalid port value.");
        process.exit(1);
      }

      port = parsedPort;
      wsPort = parsedPort + 1;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }

    if (!arg.startsWith("-")) {
      inputFile = path.resolve(arg);
    }
  }

  return { inputFile, port, wsPort };
}

function loadFileIntoSlot(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.error(`\x1b[31mFile not found: ${filePath}\x1b[0m`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  writeSlot(content);
  return path.basename(filePath);
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

const { inputFile, port, wsPort } = parseArgs(process.argv.slice(2));

let currentFilename: string | null = null;
let watcher: FSWatcher | null = null;
let server: ViteDevServer | null = null;

const wss = new WebSocketServer({ port: wsPort });

function broadcast(message: FileUpdatedMessage) {
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

function startWatching(filePath: string) {
  stopWatching();
  watcher = watch(filePath, { ignoreInitial: true });
  watcher.on("change", () => {
    currentFilename = loadFileIntoSlot(filePath);
    broadcast({ type: "file-updated", filename: currentFilename });
    console.log("\x1b[36m[jsx-viewer]\x1b[0m File changed, reloading...");
  });
}

if (inputFile) {
  currentFilename = loadFileIntoSlot(inputFile);
  startWatching(inputFile);
} else {
  resetSlot();
}

wss.on("connection", (ws: WsClient) => {
  ws.send(
    JSON.stringify({
      type: "file-updated",
      filename: currentFilename,
    } satisfies FileUpdatedMessage),
  );

  ws.on("message", (raw: RawData) => {
    try {
      const message: unknown = JSON.parse(raw.toString());
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

server = await createServer({
  root: ROOT,
  configFile: path.join(ROOT, "vite.config.ts"),
  server: {
    port,
    open: !process.env.CI,
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

let cleaningUp = false;

function cleanup() {
  if (cleaningUp) {
    return;
  }

  cleaningUp = true;

  try {
    resetSlot();
  } catch (error) {
    console.error("[jsx-viewer] Failed to reset slot:", toError(error).message);
  }

  try {
    stopWatching();
  } catch {
    // Ignore watcher shutdown failures.
  }

  try {
    wss.close();
  } catch {
    // Ignore WebSocket shutdown failures.
  }

  try {
    void server?.close();
  } catch {
    // Ignore Vite shutdown failures.
  }

  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

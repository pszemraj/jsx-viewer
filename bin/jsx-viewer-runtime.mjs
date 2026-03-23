import fs from "node:fs";
import path from "node:path";
import { watch } from "chokidar";
import { createServer } from "vite";
import { WebSocket, WebSocketServer } from "ws";
import { isClientMessage } from "../shared/protocol.mjs";
import {
  ROOT,
  clearRuntimeSlot,
  getRuntimeCacheDir,
  getRuntimeRoot,
  markRuntimePortActive,
  getRuntimeSlotModuleUrl,
  getRuntimeSlotPath,
  resetSlot,
  writeSlot,
} from "./slot.mjs";

const { version: VERSION } = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

function loadFileIntoSlot(filePath, slotPath) {
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
  writeSlot(content, slotPath);
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
let cleaningUp = false;
let runtimePort = null;

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
      currentFilename = loadFileIntoSlot(filePath, getRuntimeSlotPath(runtimePort));
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

function cleanup(exitCode = 0) {
  if (cleaningUp) {
    return;
  }

  cleaningUp = true;

  if (slotWasTouched && runtimePort !== null) {
    try {
      clearRuntimeSlot(runtimePort);
    } catch (error) {
      console.error(
        "[jsx-viewer] Failed to clear runtime slot:",
        toError(error).message,
      );
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
          resetSlot(getRuntimeSlotPath(runtimePort));
          currentFilename = null;
          broadcast({ type: "file-updated", filename: null });
          return;
        }

        stopWatching();
        writeSlot(message.content, getRuntimeSlotPath(runtimePort));
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

function listenWebSocketServer(port) {
  return new Promise((resolve, reject) => {
    const wsServer = new WebSocketServer({ port }, () => {
      wsServer.off("error", handleError);
      resolve(wsServer);
    });

    function handleError(error) {
      wsServer.off("error", handleError);
      reject(error);
    }

    wsServer.once("error", handleError);
  });
}

function initializeSlot(inputFile) {
  const slotPath = getRuntimeSlotPath(runtimePort);
  markRuntimePortActive(runtimePort);
  resetSlot(slotPath);
  slotWasTouched = true;
  currentFilename = null;

  if (inputFile) {
    currentFilename = loadFileIntoSlot(inputFile, slotPath);
  }
}

export function getViteServerConfig(port, wsPort) {
  return {
    root: ROOT,
    cacheDir: getRuntimeCacheDir(port),
    configFile: path.join(ROOT, "vite.config.ts"),
    define: {
      __JSX_VIEWER_SLOT_MODULE_URL__: JSON.stringify(
        getRuntimeSlotModuleUrl(port),
      ),
      __JSX_VIEWER_WS_PORT__: JSON.stringify(String(wsPort)),
    },
    server: {
      fs: {
        allow: [ROOT, getRuntimeRoot(port)],
      },
      port,
      open: !process.env.CI,
      strictPort: true,
    },
  };
}

export async function main(cliArgs) {
  if (cliArgs?.mode !== "run") {
    throw new TypeError(
      '[jsx-viewer] Expected parsed CLI args with mode "run".',
    );
  }

  const { inputFile, port, wsPort } = cliArgs;
  runtimePort = port;

  try {
    initializeSlot(inputFile);

    wss = await listenWebSocketServer(wsPort);
    wss.on("error", (error) => {
      console.error(
        "\x1b[31m[jsx-viewer]\x1b[0m WebSocket server error:",
        toError(error).message,
      );
      cleanup(1);
    });
    registerWebSocketHandlers();

    if (inputFile) {
      startWatching(inputFile);
    }

    server = await createServer(getViteServerConfig(port, wsPort));

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

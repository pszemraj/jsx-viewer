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

/**
 * @typedef {import("chokidar").FSWatcher} FSWatcher
 * @typedef {import("vite").InlineConfig} ViteServerConfig
 * @typedef {import("vite").ViteDevServer} ViteDevServer
 * @typedef {{ on(event: "add" | "change", listener: () => void): unknown }} ArtifactWatcher
 * @typedef {import("ws").RawData} WebSocketRawData
 * @typedef {import("ws").WebSocket} RuntimeWebSocket
 * @typedef {import("ws").WebSocketServer} RuntimeWebSocketServer
 * @typedef {import("../shared/protocol.mjs").ClientMessage} ClientMessage
 * @typedef {import("../shared/protocol.mjs").ServerMessage} ServerMessage
 * @typedef {{mode: "run", inputFile: string | null, port: number, wsPort: number}} RunCliArgs
 * @typedef {{ (): void, dispose(): void }} QueuedArtifactReload
 */

const { version: VERSION } = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

/**
 * @param {string} filePath
 * @param {string} slotPath
 * @returns {string}
 */
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

/**
 * @param {unknown} error
 * @returns {Error}
 */
function toError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

/** @type {string | null} */
let currentFilename = null;
/** @type {FSWatcher | null} */
let watcher = null;
/** @type {ViteDevServer | null} */
let server = null;
/** @type {RuntimeWebSocketServer | null} */
let wss = null;
let slotWasTouched = false;
/** @type {number | null} */
let runtimePort = null;
/** @type {Promise<void> | null} */
let cleanupPromise = null;
let scheduledExitCode = 0;
/** @type {QueuedArtifactReload | null} */
let queuedWatchedFileReload = null;
/**
 * @param {ServerMessage} message
 * @returns {void}
 */
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

/**
 * @returns {number}
 */
function requireRuntimePort() {
  if (runtimePort === null) {
    throw new Error("[jsx-viewer] Runtime port is not initialized.");
  }

  return runtimePort;
}

/**
 * @returns {RuntimeWebSocketServer}
 */
function requireWebSocketServer() {
  if (!wss) {
    throw new Error("[jsx-viewer] WebSocket server is not initialized.");
  }

  return wss;
}

function stopWatching() {
  queuedWatchedFileReload?.dispose();
  queuedWatchedFileReload = null;

  if (watcher) {
    void watcher.close();
    watcher = null;
  }
}

/**
 * Coalesce atomic-save add/change bursts into one slot write so editor save
 * strategies keep the watched-file workflow stable without duplicate reloads.
 *
 * @param {() => void} reloadArtifact
 * @param {(callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>} [schedule]
 * @param {(timer: ReturnType<typeof setTimeout>) => void} [cancel]
 * @param {number} [delayMs]
 * @returns {QueuedArtifactReload}
 */
export function createQueuedArtifactReload(
  reloadArtifact,
  schedule = setTimeout,
  cancel = clearTimeout,
  delayMs = 25,
) {
  /** @type {ReturnType<typeof setTimeout> | null} */
  let timer = null;

  const queueReload = /** @type {QueuedArtifactReload} */ (() => {
    if (timer !== null) {
      cancel(timer);
    }

    timer = schedule(() => {
      timer = null;
      reloadArtifact();
    }, delayMs);
  });

  queueReload.dispose = () => {
    if (timer === null) {
      return;
    }

    cancel(timer);
    timer = null;
  };

  return queueReload;
}

/**
 * @param {PromiseLike<unknown> | undefined | null} pendingClose
 * @param {number} [timeoutMs]
 * @returns {Promise<void>}
 */
export async function waitForCloseOperation(pendingClose, timeoutMs = 500) {
  if (!pendingClose) {
    return;
  }

  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;

  try {
    await Promise.race([
      Promise.resolve(pendingClose),
      new Promise((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

/**
 * @param {string} filePath
 * @returns {void}
 */
function startWatching(filePath) {
  const port = requireRuntimePort();
  stopWatching();
  watcher = watch(filePath, { ignoreInitial: true });

  queuedWatchedFileReload = createQueuedArtifactReload(() => {
    try {
      currentFilename = loadFileIntoSlot(filePath, getRuntimeSlotPath(port));
      broadcast({ type: "file-updated", filename: currentFilename });
      console.log("\x1b[36m[jsx-viewer]\x1b[0m File changed, reloading...");
    } catch (error) {
      console.error(
        "\x1b[31m[jsx-viewer]\x1b[0m Failed to reload watched file:",
        toError(error).message,
      );
    }
  });

  watcher.on("add", queuedWatchedFileReload);
  watcher.on("change", queuedWatchedFileReload);
}

/**
 * @param {number} [exitCode]
 * @returns {Promise<void>}
 */
async function cleanup(exitCode = 0) {
  scheduledExitCode = Math.max(scheduledExitCode, exitCode);

  if (cleanupPromise) {
    return cleanupPromise;
  }

  cleanupPromise = (async () => {
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

    const watcherToClose = watcher;
    watcher = null;

    try {
      await waitForCloseOperation(watcherToClose?.close());
    } catch {
      // Ignore watcher shutdown failures.
    }

    try {
      wss?.close();
    } catch {
      // Ignore WebSocket shutdown failures.
    }

    const serverToClose = server;
    server = null;

    try {
      await waitForCloseOperation(serverToClose?.close());
    } catch {
      // Ignore Vite shutdown failures.
    }

    process.exit(scheduledExitCode);
  })();

  return cleanupPromise;
}

function registerWebSocketHandlers() {
  const wsServer = requireWebSocketServer();
  const port = requireRuntimePort();

  wsServer.on("connection", (ws) => {
    ws.send(
      JSON.stringify({
        type: "file-updated",
        filename: currentFilename,
      }),
    );

    /**
     * @param {WebSocketRawData} raw
     * @returns {void}
     */
    ws.on("message", (raw) => {
      try {
        /** @type {unknown} */
        const message = JSON.parse(raw.toString());
        if (!isClientMessage(message)) {
          throw new Error("Unsupported WebSocket payload.");
        }

        if (message.type === "reset-slot") {
          stopWatching();
          resetSlot(getRuntimeSlotPath(port));
          currentFilename = null;
          broadcast({ type: "file-updated", filename: null });
          return;
        }

        stopWatching();
        writeSlot(message.content, getRuntimeSlotPath(port));
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

/**
 * @param {number} port
 * @returns {Promise<RuntimeWebSocketServer>}
 */
function listenWebSocketServer(port) {
  return new Promise((resolve, reject) => {
    const wsServer = new WebSocketServer({ port }, () => {
      wsServer.off("error", handleError);
      resolve(wsServer);
    });

    /**
     * @param {Error} error
     * @returns {void}
     */
    function handleError(error) {
      wsServer.off("error", handleError);
      reject(error);
    }

    wsServer.once("error", handleError);
  });
}

/**
 * @param {string | null} inputFile
 * @returns {void}
 */
function initializeSlot(inputFile) {
  const port = requireRuntimePort();
  const slotPath = getRuntimeSlotPath(port);
  markRuntimePortActive(port);
  resetSlot(slotPath);
  slotWasTouched = true;
  currentFilename = null;

  if (inputFile) {
    currentFilename = loadFileIntoSlot(inputFile, slotPath);
  }
}

/**
 * @param {number} port
 * @param {number} wsPort
 * @returns {ViteServerConfig}
 */
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
      host: "localhost",
      port,
      open: !process.env.CI,
      strictPort: true,
    },
  };
}

/**
 * @param {RunCliArgs} cliArgs
 * @returns {Promise<void>}
 */
export async function main(cliArgs) {
  if (cliArgs?.mode !== "run") {
    throw new TypeError(
      '[jsx-viewer] Expected parsed CLI args with mode "run".',
    );
  }

  const { inputFile, port, wsPort } = cliArgs;
  scheduledExitCode = 0;
  runtimePort = port;

  try {
    initializeSlot(inputFile);

    wss = await listenWebSocketServer(wsPort);
    /** @param {Error} error */
    wss.on("error", (error) => {
      console.error(
        "\x1b[31m[jsx-viewer]\x1b[0m WebSocket server error:",
        toError(error).message,
      );
      void cleanup(1);
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

    process.on("SIGINT", () => {
      void cleanup();
    });
    process.on("SIGTERM", () => {
      void cleanup();
    });
  } catch (error) {
    console.error(
      "\x1b[31m[jsx-viewer]\x1b[0m Failed to start:",
      toError(error).message,
    );
    await cleanup(1);
  }
}

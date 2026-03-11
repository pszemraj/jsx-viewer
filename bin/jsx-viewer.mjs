#!/usr/bin/env node

import { createServer } from "vite";
import { WebSocketServer } from "ws";
import { watch } from "chokidar";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLOT = path.join(ROOT, "component", "View.jsx");

// ── Parse args ──────────────────────────────────────────────
const args = process.argv.slice(2);
let inputFile = null;
let port = 3142;
let wsPort = 3143;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" || args[i] === "-p") {
    port = parseInt(args[++i], 10);
    wsPort = port + 1;
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`
  jsx-viewer - render .jsx files like .html

  Usage:
    jsx-viewer [options] [file.jsx]

  Options:
    -p, --port <n>   Dev server port (default: 3142)
    -h, --help       Show this help

  Examples:
    jsx-viewer                     # Start with drop/paste UI
    jsx-viewer dashboard.jsx       # Load and watch a file
    jsx-viewer -p 8080 app.jsx     # Custom port
`);
    process.exit(0);
  } else if (!args[i].startsWith("-")) {
    inputFile = path.resolve(args[i]);
  }
}

// ── Slot file management ────────────────────────────────────
const PLACEHOLDER = `// JSX Viewer - Placeholder
export default function Placeholder() { return null; }
Placeholder.__isPlaceholder = true;
`;

function ensureSlotDir() {
  const dir = path.dirname(SLOT);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeSlot(content) {
  ensureSlotDir();
  fs.writeFileSync(SLOT, content, "utf-8");
}

function loadFileIntoSlot(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`\x1b[31mFile not found: ${filePath}\x1b[0m`);
    process.exit(1);
  }
  const content = fs.readFileSync(filePath, "utf-8");
  writeSlot(content);
  return path.basename(filePath);
}

function resetSlot() {
  writeSlot(PLACEHOLDER);
}

// ── Start ───────────────────────────────────────────────────
let currentFilename = null;

if (inputFile) {
  currentFilename = loadFileIntoSlot(inputFile);
} else {
  resetSlot();
}

// ── WebSocket server (for browser <-> CLI communication) ───
const wss = new WebSocketServer({ port: wsPort });
const broadcast = (data) => {
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
};

wss.on("connection", (ws) => {
  // Send current state
  ws.send(
    JSON.stringify({
      type: "file-updated",
      filename: currentFilename,
    }),
  );

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === "load-jsx" && msg.content) {
        writeSlot(msg.content);
        currentFilename = msg.filename || "pasted.jsx";
        broadcast({ type: "file-updated", filename: currentFilename });
      }
    } catch (err) {
      console.error(
        `\x1b[31m[jsx-viewer]\x1b[0m Bad WebSocket message:`,
        err.message,
      );
    }
  });
});

// ── Watch the input file for external edits ─────────────────
if (inputFile) {
  const watcher = watch(inputFile, { ignoreInitial: true });
  watcher.on("change", () => {
    currentFilename = loadFileIntoSlot(inputFile);
    broadcast({ type: "file-updated", filename: currentFilename });
    console.log(`\x1b[36m[jsx-viewer]\x1b[0m File changed, reloading...`);
  });
}

// ── Start Vite ──────────────────────────────────────────────
const server = await createServer({
  root: ROOT,
  configFile: path.join(ROOT, "vite.config.js"),
  server: {
    port,
    open: !process.env.CI,
  },
});

await server.listen();

console.log();
console.log(`  \x1b[1m\x1b[36mjsx-viewer\x1b[0m \x1b[2mv1.0.0\x1b[0m`);
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
console.log(
  `  \x1b[2mDrop or paste .jsx in the browser, or pass a file via CLI.\x1b[0m`,
);
console.log();

// ── Cleanup ─────────────────────────────────────────────────
let cleaningUp = false;
function cleanup() {
  if (cleaningUp) return;
  cleaningUp = true;
  try {
    resetSlot();
  } catch (err) {
    console.error("[jsx-viewer] Failed to reset slot:", err.message);
  }
  try {
    wss.close();
  } catch {
    /* ignore */
  }
  try {
    server.close();
  } catch {
    /* ignore */
  }
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

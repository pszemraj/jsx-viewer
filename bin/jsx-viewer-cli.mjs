import path from "node:path";
import runtimeConfig from "../shared/runtime-config.json" with { type: "json" };

export const DEFAULT_VIEWER_PORT = runtimeConfig.defaultViewerPort;
export const WEB_SOCKET_PORT_OFFSET = runtimeConfig.webSocketPortOffset;
export const SUPPORTED_INPUT_EXTENSIONS = runtimeConfig.supportedInputExtensions;
export const MAX_SOCKET_PORT = 65_535;
export const MAX_VIEWER_PORT = MAX_SOCKET_PORT - WEB_SOCKET_PORT_OFFSET;

export class CliUsageError extends Error {
  constructor(message) {
    super(message);
    this.name = "CliUsageError";
  }
}

export function getWebSocketPort(viewerPort) {
  return viewerPort + WEB_SOCKET_PORT_OFFSET;
}

function formatSupportedInputExtensions() {
  return SUPPORTED_INPUT_EXTENSIONS.join(" or ");
}

function parsePortValue(value) {
  if (value === undefined) {
    throw new CliUsageError(
      "Missing value for --port. Expected a positive integer.",
    );
  }

  if (!/^\d+$/.test(value)) {
    throw new CliUsageError(
      `Invalid value for --port: "${value}". Expected a positive integer.`,
    );
  }

  const port = Number.parseInt(value, 10);
  if (port <= 0) {
    throw new CliUsageError(
      `Invalid value for --port: "${value}". Expected a positive integer.`,
    );
  }

  if (port > MAX_VIEWER_PORT) {
    throw new CliUsageError(
      `Invalid value for --port: "${value}". Expected an integer between 1 and ${MAX_VIEWER_PORT} so the WebSocket can listen on port + ${WEB_SOCKET_PORT_OFFSET}.`,
    );
  }

  return port;
}

function assertSupportedInputFile(inputPath) {
  const extension = path.extname(inputPath).toLowerCase();
  if (!SUPPORTED_INPUT_EXTENSIONS.includes(extension)) {
    throw new CliUsageError(
      `Unsupported input file "${inputPath}". Pass a ${formatSupportedInputExtensions()} file.`,
    );
  }
}

export function getHelpText() {
  return `
  jsx-viewer - render .jsx/.tsx files like .html

  Usage:
    node bin/jsx-viewer.mjs [options] [file.jsx|file.tsx]

  Options:
    -p, --port <n>   Viewer HTTP port (default: ${DEFAULT_VIEWER_PORT}, max: ${MAX_VIEWER_PORT})
                     WebSocket listens on port + ${WEB_SOCKET_PORT_OFFSET}
    -h, --help       Show this help
    -v, --version    Show version

  Notes:
    Pass zero or one .jsx/.tsx file.
    The browser auto-opens unless CI is set.

  Examples:
    node bin/jsx-viewer.mjs                     # Start with the empty drop/upload/paste UI
    node bin/jsx-viewer.mjs dashboard.tsx       # Start with a file already loaded and watched
    node bin/jsx-viewer.mjs -p 8080 app.jsx     # Custom port with a preloaded file
`;
}

export function parseCliArgs(args) {
  let inputFile = null;
  let port = DEFAULT_VIEWER_PORT;
  let hasExplicitPort = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      return { mode: "help" };
    }

    if (arg === "--version" || arg === "-v") {
      return { mode: "version" };
    }

    if (arg === "--port" || arg === "-p") {
      if (hasExplicitPort) {
        throw new CliUsageError("--port can only be provided once.");
      }

      hasExplicitPort = true;
      port = parsePortValue(args[index + 1]);
      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new CliUsageError(
        `Unknown option "${arg}". Run with "--help" for usage.`,
      );
    }

    if (inputFile !== null) {
      throw new CliUsageError(
        "Received multiple input files. Pass zero or one .jsx/.tsx file.",
      );
    }

    assertSupportedInputFile(arg);
    inputFile = path.resolve(arg);
  }

  return {
    mode: "run",
    inputFile,
    port,
    wsPort: getWebSocketPort(port),
  };
}

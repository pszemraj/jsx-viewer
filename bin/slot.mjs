import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * @typedef {{ pid: number, root: string }} RuntimeOwnerRecord
 * @typedef {{ state: "missing" } | { state: "invalid" } | { state: "present", pid: number }} RuntimeOwnerState
 * @typedef {(entryPath: string, entryName: string) => boolean} RuntimePortDirPredicate
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
export const TRACKED_SLOT_PATH = path.join(ROOT, "component", "View.tsx");
const RUNTIME_SLOTS_ENV = "JSX_VIEWER_RUNTIME_DIR";
const RUNTIME_SLOTS_DIRNAME = "jsx-viewer";
const RUNTIME_WORKSPACE_PREFIX = "workspace-";
const RUNTIME_CACHE_DIRNAME = "vite-cache";
const RUNTIME_OWNER_FILENAME = "runtime-owner.json";
const RUNTIME_PORT_DIR_PATTERN = /^port-\d+$/;
export const PLACEHOLDER = `type PlaceholderComponent = (() => null) & {
  __isPlaceholder: true;
};

const Placeholder: PlaceholderComponent = Object.assign(() => null, {
  __isPlaceholder: true as const,
});

export default Placeholder;
`;

function getRuntimeSlotsBase() {
  const configuredRoot = process.env[RUNTIME_SLOTS_ENV]?.trim();
  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }

  return os.tmpdir();
}

function getRuntimeSharedRoot() {
  const runtimeSlotsBase = getRuntimeSlotsBase();
  return path.basename(runtimeSlotsBase) === RUNTIME_SLOTS_DIRNAME
    ? runtimeSlotsBase
    : path.join(runtimeSlotsBase, RUNTIME_SLOTS_DIRNAME);
}

/**
 * @param {string} [rootPath]
 * @returns {string}
 */
function getWorkspaceFingerprint(rootPath = ROOT) {
  const resolvedRoot =
    typeof fs.realpathSync.native === "function"
      ? fs.realpathSync.native(rootPath)
      : fs.realpathSync(rootPath);
  return process.platform === "win32" ? resolvedRoot.toLowerCase() : resolvedRoot;
}

/**
 * @param {string} [rootPath]
 * @returns {string}
 */
export function getRuntimeWorkspaceName(rootPath = ROOT) {
  const digest = crypto
    .createHash("sha256")
    .update(getWorkspaceFingerprint(rootPath))
    .digest("hex")
    .slice(0, 12);

  return `${RUNTIME_WORKSPACE_PREFIX}${digest}`;
}

export function getRuntimeWorkspaceRoot() {
  return path.join(getRuntimeSharedRoot(), getRuntimeWorkspaceName());
}

export function getRuntimeSlotsRoot() {
  return getRuntimeWorkspaceRoot();
}

export function getRuntimeCacheRoot() {
  return path.join(getRuntimeSlotsRoot(), RUNTIME_CACHE_DIRNAME);
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isRuntimePortDirName(name) {
  return RUNTIME_PORT_DIR_PATTERN.test(name);
}

/**
 * @param {number} port
 * @returns {string}
 */
export function getRuntimeRoot(port) {
  return path.join(getRuntimeSlotsRoot(), `port-${port}`);
}

/**
 * @param {number} port
 * @returns {string}
 */
export function getRuntimeSlotPath(port) {
  return path.join(getRuntimeRoot(port), "component", "View.tsx");
}

/**
 * @param {number} port
 * @returns {string}
 */
export function getRuntimeCacheDir(port) {
  return path.join(getRuntimeCacheRoot(), `port-${port}`);
}

/**
 * @param {number} port
 * @returns {string}
 */
export function getRuntimeOwnerPath(port) {
  return path.join(getRuntimeRoot(port), RUNTIME_OWNER_FILENAME);
}

/**
 * @param {URL} fileUrl
 * @returns {string}
 */
function toViteFsPath(fileUrl) {
  // Vite's /@fs prefix expects UNC hosts to remain in the request path.
  return fileUrl.host ? `//${fileUrl.host}${fileUrl.pathname}` : fileUrl.pathname;
}

/**
 * @param {number} port
 * @returns {string}
 */
export function getRuntimeSlotModuleUrl(port) {
  return `/@fs${toViteFsPath(pathToFileURL(getRuntimeSlotPath(port)))}`;
}

/**
 * @param {string} slotPath
 * @returns {void}
 */
function ensureSlotDir(slotPath) {
  const dir = path.dirname(slotPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * @param {string} content
 * @param {string} [slotPath]
 * @returns {void}
 */
export function writeSlot(content, slotPath = TRACKED_SLOT_PATH) {
  ensureSlotDir(slotPath);
  fs.writeFileSync(slotPath, content, "utf-8");
}

/**
 * @param {string} [slotPath]
 * @returns {void}
 */
export function resetSlot(slotPath = TRACKED_SLOT_PATH) {
  writeSlot(PLACEHOLDER, slotPath);
}

/**
 * @param {string} [slotPath]
 * @returns {string | null}
 */
export function readSlot(slotPath = TRACKED_SLOT_PATH) {
  if (!fs.existsSync(slotPath)) {
    return null;
  }

  return fs.readFileSync(slotPath, "utf-8");
}

/**
 * @param {string} [slotPath]
 * @returns {boolean}
 */
export function slotMatchesPlaceholder(slotPath = TRACKED_SLOT_PATH) {
  return readSlot(slotPath) === PLACEHOLDER;
}

/**
 * @param {number} port
 * @returns {void}
 */
export function clearRuntimeSlot(port) {
  fs.rmSync(getRuntimeRoot(port), {
    recursive: true,
    force: true,
  });
}

/**
 * @param {number} port
 * @param {number} [pid]
 * @returns {void}
 */
export function markRuntimePortActive(port, pid = process.pid) {
  const runtimeRoot = getRuntimeRoot(port);
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.writeFileSync(
    getRuntimeOwnerPath(port),
    `${JSON.stringify({ pid, root: ROOT })}\n`,
    "utf8",
  );
}

/**
 * @param {string} rootPath
 * @param {RuntimePortDirPredicate} [shouldRemove]
 * @returns {void}
 */
function clearManagedRuntimePortDirs(
  rootPath,
  shouldRemove = (_entryPath, _entryName) => true,
) {
  if (!fs.existsSync(rootPath)) {
    return;
  }

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isRuntimePortDirName(entry.name)) {
      continue;
    }

    const entryPath = path.join(rootPath, entry.name);
    if (!shouldRemove(entryPath, entry.name)) {
      continue;
    }

    fs.rmSync(entryPath, {
      recursive: true,
      force: true,
    });
  }
}

export function clearRuntimeSlots() {
  clearManagedRuntimePortDirs(getRuntimeSlotsRoot());
}

export function clearRuntimeCaches() {
  clearManagedRuntimePortDirs(getRuntimeCacheRoot());
}

/**
 * @param {unknown} value
 * @returns {value is RuntimeOwnerRecord}
 */
function isRuntimeOwnerRecord(value) {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = /** @type {Record<string, unknown>} */ (value);
  return (
    Number.isInteger(record.pid) &&
    typeof record.root === "string"
  );
}

/**
 * @param {string} runtimeRoot
 * @returns {RuntimeOwnerState}
 */
function readRuntimeOwner(runtimeRoot) {
  const ownerPath = path.join(runtimeRoot, RUNTIME_OWNER_FILENAME);
  if (!fs.existsSync(ownerPath)) {
    return { state: "missing" };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(ownerPath, "utf8"));
    return isRuntimeOwnerRecord(parsed)
      ? { state: "present", pid: parsed.pid }
      : { state: "invalid" };
  } catch {
    return { state: "invalid" };
  }
}

/**
 * @param {number} pid
 * @returns {boolean}
 */
function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return /** @type {NodeJS.ErrnoException} */ (error).code === "EPERM";
  }
}

/**
 * @param {string} runtimeRoot
 * @returns {boolean}
 */
function hasActiveRuntimeOwner(runtimeRoot) {
  const owner = readRuntimeOwner(runtimeRoot);

  if (owner.state === "missing") {
    // Preserve legacy runtime dirs created before ownership tracking existed.
    return true;
  }

  if (owner.state === "invalid") {
    return false;
  }

  return isProcessAlive(owner.pid);
}

export function clearRuntimeArtifacts() {
  const runtimeSlotsRoot = getRuntimeSlotsRoot();
  const runtimeCacheRoot = getRuntimeCacheRoot();
  /** @type {Set<string>} */
  const activePortDirs = new Set();

  clearManagedRuntimePortDirs(runtimeSlotsRoot, (runtimeRoot, portDirName) => {
    const isActive = hasActiveRuntimeOwner(runtimeRoot);
    if (isActive) {
      activePortDirs.add(portDirName);
    }

    return !isActive;
  });

  clearManagedRuntimePortDirs(runtimeCacheRoot, (_runtimeRoot, portDirName) => {
    if (activePortDirs.has(portDirName)) {
      return false;
    }

    return !fs.existsSync(path.join(runtimeSlotsRoot, portDirName));
  });
}

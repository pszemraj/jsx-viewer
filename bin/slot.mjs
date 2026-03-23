import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
export const TRACKED_SLOT_PATH = path.join(ROOT, "component", "View.tsx");
const RUNTIME_SLOTS_ENV = "JSX_VIEWER_RUNTIME_DIR";
const RUNTIME_SLOTS_DIRNAME = "jsx-viewer";
const RUNTIME_CACHE_DIRNAME = "vite-cache";
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

export function getRuntimeSlotsRoot() {
  const runtimeSlotsBase = getRuntimeSlotsBase();
  return path.basename(runtimeSlotsBase) === RUNTIME_SLOTS_DIRNAME
    ? runtimeSlotsBase
    : path.join(runtimeSlotsBase, RUNTIME_SLOTS_DIRNAME);
}

export function getRuntimeCacheRoot() {
  return path.join(getRuntimeSlotsRoot(), RUNTIME_CACHE_DIRNAME);
}

function isRuntimePortDirName(name) {
  return RUNTIME_PORT_DIR_PATTERN.test(name);
}

export function getRuntimeRoot(port) {
  return path.join(getRuntimeSlotsRoot(), `port-${port}`);
}

export function getRuntimeSlotPath(port) {
  return path.join(getRuntimeRoot(port), "component", "View.tsx");
}

export function getRuntimeCacheDir(port) {
  return path.join(getRuntimeCacheRoot(), `port-${port}`);
}

function toViteFsPath(fileUrl) {
  // Vite's /@fs prefix expects UNC hosts to remain in the request path.
  return fileUrl.host ? `//${fileUrl.host}${fileUrl.pathname}` : fileUrl.pathname;
}

export function getRuntimeSlotModuleUrl(port) {
  return `/@fs${toViteFsPath(pathToFileURL(getRuntimeSlotPath(port)))}`;
}

function ensureSlotDir(slotPath) {
  const dir = path.dirname(slotPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeSlot(content, slotPath = TRACKED_SLOT_PATH) {
  ensureSlotDir(slotPath);
  fs.writeFileSync(slotPath, content, "utf-8");
}

export function resetSlot(slotPath = TRACKED_SLOT_PATH) {
  writeSlot(PLACEHOLDER, slotPath);
}

export function readSlot(slotPath = TRACKED_SLOT_PATH) {
  if (!fs.existsSync(slotPath)) {
    return null;
  }

  return fs.readFileSync(slotPath, "utf-8");
}

export function slotMatchesPlaceholder(slotPath = TRACKED_SLOT_PATH) {
  return readSlot(slotPath) === PLACEHOLDER;
}

export function clearRuntimeSlot(port) {
  fs.rmSync(getRuntimeRoot(port), {
    recursive: true,
    force: true,
  });
}

function clearManagedRuntimePortDirs(rootPath) {
  if (!fs.existsSync(rootPath)) {
    return;
  }

  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    if (!entry.isDirectory() || !isRuntimePortDirName(entry.name)) {
      continue;
    }

    fs.rmSync(path.join(rootPath, entry.name), {
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

export function clearRuntimeArtifacts() {
  clearRuntimeSlots();
  clearRuntimeCaches();
}

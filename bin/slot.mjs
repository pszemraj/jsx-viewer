import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
export const TRACKED_SLOT_PATH = path.join(ROOT, "component", "View.tsx");
const RUNTIME_SLOTS_ENV = "JSX_VIEWER_RUNTIME_DIR";
export const PLACEHOLDER = `type PlaceholderComponent = (() => null) & {
  __isPlaceholder: true;
};

const Placeholder: PlaceholderComponent = Object.assign(() => null, {
  __isPlaceholder: true as const,
});

export default Placeholder;
`;

function getRuntimeSlotsRoot() {
  const configuredRoot = process.env[RUNTIME_SLOTS_ENV]?.trim();
  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }

  return path.join(os.tmpdir(), "jsx-viewer");
}

export function getRuntimeRoot(port) {
  return path.join(getRuntimeSlotsRoot(), `port-${port}`);
}

export function getRuntimeSlotPath(port) {
  return path.join(getRuntimeRoot(port), "component", "View.tsx");
}

export function getRuntimeSlotModuleUrl(port) {
  const normalizedPath = getRuntimeSlotPath(port).replace(/\\/g, "/");
  return `/@fs/${normalizedPath}`;
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

export function clearRuntimeSlots() {
  fs.rmSync(getRuntimeSlotsRoot(), {
    recursive: true,
    force: true,
  });
}

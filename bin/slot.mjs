import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
const SLOT_PATH = path.join(ROOT, "component", "View.tsx");
export const PLACEHOLDER = `type PlaceholderComponent = (() => null) & {
  __isPlaceholder: true;
};

const Placeholder: PlaceholderComponent = Object.assign(() => null, {
  __isPlaceholder: true as const,
});

export default Placeholder;
`;

function ensureSlotDir() {
  const dir = path.dirname(SLOT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeSlot(content) {
  ensureSlotDir();
  fs.writeFileSync(SLOT_PATH, content, "utf-8");
}

export function resetSlot() {
  writeSlot(PLACEHOLDER);
}

export function readSlot() {
  if (!fs.existsSync(SLOT_PATH)) {
    return null;
  }

  return fs.readFileSync(SLOT_PATH, "utf-8");
}

export function slotMatchesPlaceholder() {
  return readSlot() === PLACEHOLDER;
}

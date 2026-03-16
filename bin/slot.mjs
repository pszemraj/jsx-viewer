import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, "..");
export const SLOT = path.join(ROOT, "component", "View.jsx");
export const PLACEHOLDER = `// JSX Viewer - Placeholder
export default function Placeholder() {
  return null;
}
Placeholder.__isPlaceholder = true;
`;

export function ensureSlotDir() {
  const dir = path.dirname(SLOT);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function writeSlot(content) {
  ensureSlotDir();
  fs.writeFileSync(SLOT, content, "utf-8");
}

export function resetSlot() {
  writeSlot(PLACEHOLDER);
}

export function readSlot() {
  if (!fs.existsSync(SLOT)) {
    return null;
  }
  return fs.readFileSync(SLOT, "utf-8");
}

export function slotMatchesPlaceholder() {
  return readSlot() === PLACEHOLDER;
}

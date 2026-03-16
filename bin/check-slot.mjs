#!/usr/bin/env node

import { PLACEHOLDER, SLOT, resetSlot, slotMatchesPlaceholder } from "./slot.mjs";

const shouldFix = process.argv.includes("--fix");

if (shouldFix) {
  resetSlot();
  console.log("[jsx-viewer] Reset component/View.jsx to the tracked placeholder.");
  process.exit(0);
}

if (!slotMatchesPlaceholder()) {
  console.error("[jsx-viewer] component/View.jsx is a transient render slot and must not be committed loaded.");
  console.error(`[jsx-viewer] Reset it with: node ${SLOT.includes("\\") ? "bin\\check-slot.mjs --fix" : "bin/check-slot.mjs --fix"}`);
  console.error("[jsx-viewer] Or discard it with: git restore component/View.jsx");
  process.exit(1);
}

if (PLACEHOLDER.length === 0) {
  console.error("[jsx-viewer] Placeholder content is unexpectedly empty.");
  process.exit(1);
}

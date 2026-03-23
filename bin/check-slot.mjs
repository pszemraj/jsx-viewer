#!/usr/bin/env node

import { resetSlot, slotMatchesPlaceholder } from "./slot.mjs";

const shouldFix = process.argv.includes("--fix");

if (shouldFix) {
  resetSlot();
  console.log("[jsx-viewer] Reset component/View.tsx to the tracked placeholder.");
  process.exit(0);
}

if (!slotMatchesPlaceholder()) {
  console.error(
    "[jsx-viewer] component/View.tsx is a transient render slot and must not be committed loaded.",
  );
  console.error("[jsx-viewer] Reset it with: npm run slot:reset");
  console.error("[jsx-viewer] Or discard it with: git restore component/View.tsx");
  process.exit(1);
}

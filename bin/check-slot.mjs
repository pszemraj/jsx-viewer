#!/usr/bin/env node

import {
  clearRuntimeSlots,
  resetSlot,
  slotMatchesPlaceholder,
} from "./slot.mjs";

const shouldFix = process.argv.includes("--fix");

if (shouldFix) {
  resetSlot();
  clearRuntimeSlots();
  console.log(
    "[jsx-viewer] Reset component/View.tsx and cleared transient runtime slots.",
  );
  process.exit(0);
}

if (!slotMatchesPlaceholder()) {
  console.error(
    "[jsx-viewer] component/View.tsx is a tracked placeholder file and must not be committed loaded.",
  );
  console.error("[jsx-viewer] Reset it with: npm run slot:reset");
  console.error("[jsx-viewer] Or discard it with: git restore component/View.tsx");
  process.exit(1);
}

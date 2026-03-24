#!/usr/bin/env node

import {
  clearRuntimeArtifacts,
  resetSlot,
  slotMatchesPlaceholder,
} from "./slot.mjs";

const shouldFix = process.argv.includes("--fix");

if (shouldFix) {
  resetSlot();
  clearRuntimeArtifacts();
  console.log(
    "[jsx-viewer] Reset component/View.tsx and cleared inactive transient runtime slots and Vite cache for this checkout.",
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

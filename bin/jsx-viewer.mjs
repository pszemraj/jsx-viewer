#!/usr/bin/env node

import { register } from "tsx/esm/api";

const unregister = register();

try {
  await import("./jsx-viewer.ts");
} finally {
  await unregister();
}

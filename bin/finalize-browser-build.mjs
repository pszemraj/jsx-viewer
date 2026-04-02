import { existsSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

const distDir = path.resolve(process.cwd(), "dist-browser");
const sourceHtml = path.join(distDir, "index.browser.html");
const targetHtml = path.join(distDir, "index.html");

if (!existsSync(sourceHtml)) {
  throw new Error(`Expected browser entry at ${sourceHtml}, but it was not found.`);
}

if (existsSync(targetHtml)) {
  throw new Error(`Refusing to overwrite existing ${targetHtml}.`);
}

renameSync(sourceHtml, targetHtml);
writeFileSync(path.join(distDir, ".nojekyll"), "");

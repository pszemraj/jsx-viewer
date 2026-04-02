import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BROWSER_RUNTIME_ENTRIES } from "./src/browser/runtimeManifest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeBasePath(value: string | undefined) {
  if (typeof value !== "string" || value.length === 0 || value === "/") {
    return "/";
  }

  const trimmed = value.replace(/^\/+|\/+$/g, "");
  return trimmed.length === 0 ? "/" : `/${trimmed}/`;
}

const runtimeInputs = Object.values(BROWSER_RUNTIME_ENTRIES).reduce<
  Record<string, string>
>((inputs, entry) => {
  inputs[entry.entryName] = path.resolve(__dirname, entry.devPath.slice(1));
  return inputs;
}, {});

export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  plugins: [react()],
  build: {
    outDir: "dist-browser",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        "index.browser": path.resolve(__dirname, "index.browser.html"),
        ...runtimeInputs,
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name.startsWith("runtime/")) {
            return `${chunkInfo.name}.js`;
          }

          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-dom/client",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "recharts",
      "lucide-react",
      "d3",
      "three",
      "lodash",
      "mathjs",
      "papaparse",
      "chart.js",
      "tone",
      "@babel/standalone",
    ],
  },
});

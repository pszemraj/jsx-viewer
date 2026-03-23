import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import runtimeConfig from "./shared/runtime-config.json";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  define: {
    __JSX_VIEWER_SLOT_MODULE_URL__: JSON.stringify("/component/View.tsx"),
    __JSX_VIEWER_WS_PORT__: JSON.stringify(
      String(runtimeConfig.defaultViewerPort + runtimeConfig.webSocketPortOffset),
    ),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: runtimeConfig.defaultViewerPort,
    open: true,
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "recharts",
      "lucide-react",
      "d3",
      "three",
      "lodash",
      "mathjs",
      "papaparse",
      "chart.js",
      "tone",
    ],
  },
});

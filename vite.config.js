import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3142,
    open: true,
  },
  // Pre-optimize heavy deps so first load is fast
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
    ],
  },
});

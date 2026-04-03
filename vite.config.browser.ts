import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteBrowserDevRootRequest } from "./src/browser/devEntryUrl";
import { BROWSER_RUNTIME_ENTRIES } from "./src/browser/runtimeManifest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BROWSER_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' blob:",
  "connect-src 'self'",
  "img-src 'self' blob: data:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "upgrade-insecure-requests",
].join("; ");

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

function browserContentSecurityPolicy() {
  return {
    name: "browser-content-security-policy",
    apply: "build" as const,
    transformIndexHtml() {
      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: BROWSER_CONTENT_SECURITY_POLICY,
          },
          injectTo: "head-prepend" as const,
        },
      ];
    },
  };
}

function browserDevEntrypoint() {
  return {
    name: "browser-dev-entrypoint",
    apply: "serve" as const,
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url) {
          req.url = rewriteBrowserDevRootRequest(req.url);
        }

        next();
      });
    },
  };
}

export default defineConfig({
  base: normalizeBasePath(process.env.VITE_BASE_PATH),
  // Keep the source HTML free of CSP so Vite's dev preamble can bootstrap.
  // The production Pages artifact gets the policy injected at build time.
  plugins: [react(), browserContentSecurityPolicy(), browserDevEntrypoint()],
  build: {
    outDir: "dist-browser",
    emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: "strict",
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

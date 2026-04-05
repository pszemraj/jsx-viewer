import type { Connect, Plugin, ViteDevServer } from "vite";
import { defineConfig } from "vite";
import type { ServerResponse } from "node:http";
import { createHash } from "node:crypto";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeBrowserBasePath } from "./src/browser/basePath";
import { rewriteBrowserDevRootRequest } from "./src/browser/devEntryUrl";
import { BROWSER_RUNTIME_ENTRIES } from "./src/browser/runtimeManifest";
import { buildBrowserRuntimeImportMap } from "./src/browser/runtimeImportMap";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const runtimeInputs = Object.values(BROWSER_RUNTIME_ENTRIES).reduce<
  Record<string, string>
>((inputs, entry) => {
  inputs[entry.entryName] = path.resolve(__dirname, entry.devPath.slice(1));
  return inputs;
}, {});

export function computeInlineScriptHash(contents: string) {
  return `sha256-${createHash("sha256").update(contents, "utf8").digest("base64")}`;
}

export function buildBrowserContentSecurityPolicy(options?: {
  inlineScriptHashes?: readonly string[];
}) {
  const inlineScriptHashes = options?.inlineScriptHashes ?? [];
  const scriptSrc = [
    "'self'",
    "blob:",
    "https://esm.sh",
    "https://cdn.tailwindcss.com",
    ...inlineScriptHashes.map((hash) => `'${hash}'`),
  ];
  // Hosted mode is a trusted-artifact browser path, so preserve normal HTTPS
  // image/data requests while still constraining executable script origins.
  const connectSrc = ["'self'", "https:", "wss:"];
  const imgSrc = ["'self'", "https:", "blob:", "data:"];

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    `img-src ${imgSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function buildPreviewImportMapScriptContents(
  basePath: string | undefined,
  dev: boolean,
) {
  return JSON.stringify(buildBrowserRuntimeImportMap(basePath, dev), null, 2);
}

function browserContentSecurityPolicy(): Plugin {
  return {
    name: "browser-content-security-policy",
    apply: "build" as const,
    transformIndexHtml(_html, context) {
      const previewImportMap = context.filename.endsWith("preview-frame.html")
        ? buildPreviewImportMapScriptContents(process.env.VITE_BASE_PATH, false)
        : null;

      return [
        {
          tag: "meta",
          attrs: {
            "http-equiv": "Content-Security-Policy",
            content: buildBrowserContentSecurityPolicy({
              inlineScriptHashes: previewImportMap
                ? [computeInlineScriptHash(previewImportMap)]
                : [],
            }),
          },
          injectTo: "head-prepend" as const,
        },
      ];
    },
  };
}

function browserPreviewImportMap(): Plugin {
  return {
    name: "browser-preview-import-map",
    transformIndexHtml(_html, context) {
      if (!context.filename.endsWith("preview-frame.html")) {
        return;
      }

      return [
        {
          tag: "script",
          attrs: {
            type: "importmap",
          },
          children: buildPreviewImportMapScriptContents(
            process.env.VITE_BASE_PATH,
            context.server !== undefined,
          ),
          injectTo: "head-prepend" as const,
        },
      ];
    },
  };
}

function browserDevEntrypoint(): Plugin {
  return {
    name: "browser-dev-entrypoint",
    apply: "serve" as const,
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        (
          req: Connect.IncomingMessage,
          _res: ServerResponse,
          next: Connect.NextFunction,
        ) => {
          if (req.url) {
            req.url = rewriteBrowserDevRootRequest(req.url, server.config.base);
          }

          next();
        },
      );
    },
  };
}

export default defineConfig({
  base: normalizeBrowserBasePath(process.env.VITE_BASE_PATH),
  // Keep the source HTML free of CSP so Vite's dev preamble can bootstrap.
  // The production Pages artifact gets the policy injected at build time.
  plugins: [
    react(),
    browserPreviewImportMap(),
    browserContentSecurityPolicy(),
    browserDevEntrypoint(),
  ],
  build: {
    outDir: "dist-browser",
    emptyOutDir: true,
    rollupOptions: {
      preserveEntrySignatures: "strict",
      input: {
        "index.browser": path.resolve(__dirname, "index.browser.html"),
        "preview-frame": path.resolve(__dirname, "preview-frame.html"),
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
      "@babel/standalone",
    ],
  },
});

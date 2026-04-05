export interface BrowserRuntimeEntry {
  readonly entryName: string;
  readonly devPath: `/${string}`;
}

export const BROWSER_RUNTIME_ENTRIES = {
  react: {
    entryName: "runtime/react",
    devPath: "/src/browser/runtime/react.ts",
  },
  "react-dom": {
    entryName: "runtime/react-dom",
    devPath: "/src/browser/runtime/react-dom.ts",
  },
  "react-dom/client": {
    entryName: "runtime/react-dom-client",
    devPath: "/src/browser/runtime/react-dom-client.ts",
  },
  "react/jsx-runtime": {
    entryName: "runtime/react-jsx-runtime",
    devPath: "/src/browser/runtime/react-jsx-runtime.ts",
  },
  "react/jsx-dev-runtime": {
    entryName: "runtime/react-jsx-dev-runtime",
    devPath: "/src/browser/runtime/react-jsx-dev-runtime.ts",
  },
} as const satisfies Record<string, BrowserRuntimeEntry>;

export type BrowserRuntimeSpecifier = keyof typeof BROWSER_RUNTIME_ENTRIES;

export const BROWSER_ARTIFACT_RUNTIME_SPECIFIERS = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
] as const satisfies readonly BrowserRuntimeSpecifier[];

export const BROWSER_RUNTIME_IMPORT_MAP_SPECIFIERS = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
] as const satisfies readonly BrowserRuntimeSpecifier[];

export const BROWSER_RUNTIME_DISPLAY_SPECIFIERS = [
  "react",
  "react-dom",
] as const satisfies readonly BrowserRuntimeSpecifier[];

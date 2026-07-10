export interface BrowserRuntimeEntry {
  readonly entryName: string;
  readonly devPath: string;
}

export const BROWSER_RUNTIME_ENTRIES = {
  react: {
    entryName: "runtime/react",
    devPath: "src/browser/runtime/react.ts",
  },
  "react-dom": {
    entryName: "runtime/react-dom",
    devPath: "src/browser/runtime/react-dom.ts",
  },
  "react-dom/client": {
    entryName: "runtime/react-dom-client",
    devPath: "src/browser/runtime/react-dom-client.ts",
  },
  "react/jsx-runtime": {
    entryName: "runtime/react-jsx-runtime",
    devPath: "src/browser/runtime/react-jsx-runtime.ts",
  },
  "react/jsx-dev-runtime": {
    entryName: "runtime/react-jsx-dev-runtime",
    devPath: "src/browser/runtime/react-jsx-dev-runtime.ts",
  },
} as const satisfies Record<string, BrowserRuntimeEntry>;

export type BrowserRuntimeSpecifier = keyof typeof BROWSER_RUNTIME_ENTRIES;

export const BROWSER_RUNTIME_SPECIFIERS = Object.freeze(
  Object.keys(BROWSER_RUNTIME_ENTRIES) as BrowserRuntimeSpecifier[],
);

export function isBrowserRuntimeSpecifier(
  specifier: string,
): specifier is BrowserRuntimeSpecifier {
  return specifier in BROWSER_RUNTIME_ENTRIES;
}

export function getBrowserRuntimeModulePath(
  specifier: BrowserRuntimeSpecifier,
  dev = false,
) {
  const entry = BROWSER_RUNTIME_ENTRIES[specifier];

  return dev ? entry.devPath : `${entry.entryName}.js`;
}

export const BROWSER_RUNTIME_DISPLAY_SPECIFIERS = [
  "react",
  "react-dom",
] as const satisfies readonly BrowserRuntimeSpecifier[];

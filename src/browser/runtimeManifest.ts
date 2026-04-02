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
  recharts: {
    entryName: "runtime/recharts",
    devPath: "/src/browser/runtime/recharts.ts",
  },
  "lucide-react": {
    entryName: "runtime/lucide-react",
    devPath: "/src/browser/runtime/lucide-react.ts",
  },
  d3: {
    entryName: "runtime/d3",
    devPath: "/src/browser/runtime/d3.ts",
  },
  three: {
    entryName: "runtime/three",
    devPath: "/src/browser/runtime/three.ts",
  },
  lodash: {
    entryName: "runtime/lodash",
    devPath: "/src/browser/runtime/lodash.ts",
  },
  mathjs: {
    entryName: "runtime/mathjs",
    devPath: "/src/browser/runtime/mathjs.ts",
  },
  papaparse: {
    entryName: "runtime/papaparse",
    devPath: "/src/browser/runtime/papaparse.ts",
  },
  "chart.js": {
    entryName: "runtime/chartjs",
    devPath: "/src/browser/runtime/chartjs.ts",
  },
  tone: {
    entryName: "runtime/tone",
    devPath: "/src/browser/runtime/tone.ts",
  },
} as const satisfies Record<string, BrowserRuntimeEntry>;

export type BrowserRuntimeSpecifier = keyof typeof BROWSER_RUNTIME_ENTRIES;

export const BROWSER_RUNTIME_SPECIFIERS = Object.keys(
  BROWSER_RUNTIME_ENTRIES,
) as BrowserRuntimeSpecifier[];

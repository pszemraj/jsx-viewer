import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as ChartJsFacade from "./runtime/chartjs";
import * as D3Facade from "./runtime/d3";
import * as LucideReactFacade from "./runtime/lucide-react";
import * as MathJsFacade from "./runtime/mathjs";
import * as RechartsFacade from "./runtime/recharts";
import * as ThreeFacade from "./runtime/three";
import * as ToneFacade from "./runtime/tone";

interface RuntimeFacadeParityCase {
  readonly facadeSourceUrl: URL;
  readonly moduleUrl: URL;
  readonly name: string;
  readonly sampleExport: string;
  readonly facadeExports: Record<string, unknown>;
}

const runtimeFacadeParityCases: RuntimeFacadeParityCase[] = [
  {
    facadeExports: ChartJsFacade as Record<string, unknown>,
    facadeSourceUrl: new URL("./runtime/chartjs.ts", import.meta.url),
    moduleUrl: new URL("../../node_modules/chart.js/dist/chart.js", import.meta.url),
    name: "chart.js",
    sampleExport: "Chart",
  },
  {
    facadeExports: D3Facade as Record<string, unknown>,
    facadeSourceUrl: new URL("./runtime/d3.ts", import.meta.url),
    moduleUrl: new URL("../../node_modules/d3/src/index.js", import.meta.url),
    name: "d3",
    sampleExport: "scaleLinear",
  },
  {
    facadeExports: LucideReactFacade as Record<string, unknown>,
    facadeSourceUrl: new URL("./runtime/lucide-react.ts", import.meta.url),
    moduleUrl: new URL(
      "../../node_modules/lucide-react/dist/esm/lucide-react.js",
      import.meta.url,
    ),
    name: "lucide-react",
    sampleExport: "Activity",
  },
  {
    facadeExports: MathJsFacade as Record<string, unknown>,
    facadeSourceUrl: new URL("./runtime/mathjs.ts", import.meta.url),
    moduleUrl: new URL("../../node_modules/mathjs/lib/esm/index.js", import.meta.url),
    name: "mathjs",
    sampleExport: "add",
  },
  {
    facadeExports: RechartsFacade as Record<string, unknown>,
    facadeSourceUrl: new URL("./runtime/recharts.ts", import.meta.url),
    moduleUrl: new URL("../../node_modules/recharts/es6/index.js", import.meta.url),
    name: "recharts",
    sampleExport: "LineChart",
  },
  {
    facadeExports: ThreeFacade as Record<string, unknown>,
    facadeSourceUrl: new URL("./runtime/three.ts", import.meta.url),
    moduleUrl: new URL("../../node_modules/three/build/three.module.js", import.meta.url),
    name: "three",
    sampleExport: "Scene",
  },
  {
    facadeExports: ToneFacade as Record<string, unknown>,
    facadeSourceUrl: new URL("./runtime/tone.ts", import.meta.url),
    moduleUrl: new URL("../../node_modules/tone/build/esm/index.js", import.meta.url),
    name: "tone",
    sampleExport: "Synth",
  },
];

for (const runtimeFacadeCase of runtimeFacadeParityCases) {
  test(
    `browser runtime ${runtimeFacadeCase.name} facade matches the package ESM export surface`,
    async () => {
      const packageExports = (await import(runtimeFacadeCase.moduleUrl.href)) as Record<
        string,
        unknown
      >;
      const facadeSource = readFileSync(runtimeFacadeCase.facadeSourceUrl, "utf8");

      assert.equal(
        Object.prototype.hasOwnProperty.call(runtimeFacadeCase.facadeExports, "default"),
        false,
      );
      assert.equal(
        Object.prototype.hasOwnProperty.call(packageExports, "default"),
        false,
      );
      assert.equal(facadeSource.includes("export default"), false);
      assert.notEqual(
        runtimeFacadeCase.facadeExports[runtimeFacadeCase.sampleExport],
        undefined,
      );
      assert.notEqual(packageExports[runtimeFacadeCase.sampleExport], undefined);
    },
  );
}

import { collectHttpOrigins } from "./httpOrigins";

export interface CorporatePreflightReport {
  ok: boolean;
  findings: string[];
  origins: string[];
}

export function collectContactedOrigins(
  resourceNames:
    | readonly string[]
    | undefined = typeof performance === "undefined"
    ? []
    : performance.getEntriesByType("resource").map((entry) => entry.name),
  currentOrigin:
    | string
    | undefined = typeof location === "undefined" ? undefined : location.origin,
) {
  return collectHttpOrigins(resourceNames, currentOrigin);
}

export async function runCorporatePreflight(): Promise<CorporatePreflightReport> {
  const findings: string[] = [];
  let blobUrl: string | null = null;

  try {
    blobUrl = URL.createObjectURL(
      new Blob(["export default 42"], { type: "text/javascript" }),
    );

    const mod = (await import(
      /* @vite-ignore */ blobUrl
    )) as { default?: unknown };

    if (mod.default !== 42) {
      findings.push("Blob-backed module import returned an unexpected result.");
    }
  } catch {
    findings.push(
      "This browser or policy blocks blob-backed ES module imports, which GitHub Pages mode requires.",
    );
  } finally {
    if (blobUrl !== null) {
      URL.revokeObjectURL(blobUrl);
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    origins: collectContactedOrigins(),
  };
}

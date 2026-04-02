export interface CorporatePreflightReport {
  ok: boolean;
  findings: string[];
  origins: string[];
}

function toHttpOrigin(value: string) {
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value)) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
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
  const origins = new Set<string>();
  const resolvedCurrentOrigin =
    typeof currentOrigin === "string" ? toHttpOrigin(currentOrigin) : null;

  if (resolvedCurrentOrigin) {
    origins.add(resolvedCurrentOrigin);
  }

  for (const resourceName of resourceNames) {
    const origin = toHttpOrigin(resourceName);
    if (origin) {
      origins.add(origin);
    }
  }

  return Array.from(origins).sort();
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

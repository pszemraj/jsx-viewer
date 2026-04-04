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

export function collectHttpOrigins(
  resourceNames: readonly string[],
  currentOrigin?: string,
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

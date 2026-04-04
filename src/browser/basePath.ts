export function normalizeBrowserBasePath(value: string | undefined) {
  if (typeof value !== "string" || value.length === 0 || value === "/") {
    return "/";
  }

  const trimmed = value.replace(/^\/+|\/+$/g, "");
  return trimmed.length === 0 ? "/" : `/${trimmed}/`;
}

export function matchesBrowserBasePath(
  pathname: string,
  basePath: string | undefined,
) {
  const normalizedBasePath = normalizeBrowserBasePath(basePath);

  if (pathname === normalizedBasePath) {
    return true;
  }

  if (normalizedBasePath === "/") {
    return pathname === "/";
  }

  return pathname === normalizedBasePath.slice(0, -1);
}

export function resolveBrowserBaseUrl(origin: string, basePath: string | undefined) {
  return new URL(normalizeBrowserBasePath(basePath), origin);
}

export function stripLeadingSlash(pathname: string) {
  return pathname.replace(/^\/+/, "");
}

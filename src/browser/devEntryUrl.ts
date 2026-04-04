import {
  matchesBrowserBasePath,
  normalizeBrowserBasePath,
} from "./basePath";

function isBrowserDevEntryRequest(pathname: string, basePath: string) {
  if (matchesBrowserBasePath(pathname, basePath)) {
    return true;
  }

  return pathname === `${basePath}index.html`;
}

export function rewriteBrowserDevRootRequest(
  requestUrl: string,
  basePath?: string,
) {
  const url = new URL(requestUrl, "http://localhost");
  const normalizedBasePath = normalizeBrowserBasePath(basePath);

  if (!isBrowserDevEntryRequest(url.pathname, normalizedBasePath)) {
    return requestUrl;
  }

  url.pathname = `${normalizedBasePath}index.browser.html`;
  return `${url.pathname}${url.search}`;
}

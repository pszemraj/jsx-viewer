import {
  matchesBrowserBasePath,
  normalizeBrowserBasePath,
} from "./basePath";

export function rewriteBrowserDevRootRequest(
  requestUrl: string,
  basePath?: string,
) {
  const url = new URL(requestUrl, "http://localhost");
  const normalizedBasePath = normalizeBrowserBasePath(basePath);

  if (!matchesBrowserBasePath(url.pathname, normalizedBasePath)) {
    return requestUrl;
  }

  url.pathname = `${normalizedBasePath}index.browser.html`;
  return `${url.pathname}${url.search}`;
}

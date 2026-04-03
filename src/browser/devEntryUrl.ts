export function rewriteBrowserDevRootRequest(requestUrl: string) {
  const url = new URL(requestUrl, "http://localhost");

  if (url.pathname !== "/") {
    return requestUrl;
  }

  return `/index.browser.html${url.search}`;
}

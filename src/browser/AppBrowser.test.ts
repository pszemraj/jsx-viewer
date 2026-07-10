import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  BROWSER_REPOSITORY_URL,
  default as AppBrowser,
} from "./AppBrowser";

test("browser shell links the header wordmark to the repository", () => {
  const html = renderToString(createElement(AppBrowser));

  assert.equal(html.includes(`href="${BROWSER_REPOSITORY_URL}"`), true);
  assert.equal(html.includes('target="_blank"'), true);
  assert.equal(html.includes('rel="noopener noreferrer"'), true);
});

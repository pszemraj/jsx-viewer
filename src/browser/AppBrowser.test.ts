import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import App from "../App";
import AppBrowser from "./AppBrowser";

for (const [mode, Component] of [
  ["local", App],
  ["browser", AppBrowser],
] as const) {
  test(`${mode} shell links the header wordmark to GitHub issues`, () => {
    const html = renderToString(createElement(Component));

    assert.equal(
      html.includes(
        'href="https://github.com/pszemraj/jsx-viewer/issues"',
      ),
      true,
    );
    assert.equal(html.includes('target="_blank"'), true);
    assert.equal(html.includes('rel="noopener noreferrer"'), true);
    assert.equal(
      html.includes('aria-label="Report an issue with jsx-viewer on GitHub"'),
      true,
    );
  });
}

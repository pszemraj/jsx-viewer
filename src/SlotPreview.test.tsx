import assert from "node:assert/strict";
import test from "node:test";
import { lazy } from "react";
import { renderToString } from "react-dom/server";
import { SlotPreview } from "./SlotPreview";

function PlainComponent() {
  return <div>ready</div>;
}

test("renders plain components without the suspense fallback", () => {
  const html = renderToString(
    <SlotPreview Component={PlainComponent} version={1} />,
  );

  assert.match(html, /ready/);
  assert.doesNotMatch(html, /Loading component/);
});

test("renders lazy components behind the suspense fallback instead of throwing", () => {
  const LazyComponent = lazy(
    () =>
      new Promise<{ default: typeof PlainComponent }>(() => {
        // Keep the lazy import pending so the Suspense fallback is rendered.
      }),
  );

  const html = renderToString(
    <SlotPreview Component={LazyComponent} version={1} />,
  );

  assert.match(html, /Loading component/);
});

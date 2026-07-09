import { Suspense } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { type SlotComponent } from "./slotComponent";

const MONO = '"JetBrains Mono", "Fira Code", monospace';

interface SlotPreviewProps {
  Component: SlotComponent;
  version: number;
}

function LoadingPreview() {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 49px)",
        background: "#0a0a0a",
        color: "#ededed",
        fontFamily: MONO,
        padding: "32px",
      }}
    >
      <div style={{ maxWidth: "720px", margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              background: "#f59e0b",
            }}
          />
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 500,
            }}
          >
            Loading component
          </h2>
        </div>
        <p
          style={{
            color: "#888",
            fontSize: "13px",
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Waiting for the exported React.lazy component to finish resolving.
        </p>
      </div>
    </div>
  );
}

export function SlotPreview({ Component, version }: SlotPreviewProps) {
  return (
    // Reset the preview subtree on each successful reload so stale render
    // errors and lazy-resolution state do not leak across artifact swaps.
    <ErrorBoundary key={version}>
      <Suspense fallback={<LoadingPreview />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}

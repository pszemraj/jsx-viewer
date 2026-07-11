import { Suspense } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { type SlotComponent } from "./slotComponent";
import { ViewerStatusPanel } from "./viewerShell";

interface SlotPreviewProps {
  Component: SlotComponent;
  version: number;
}

function LoadingPreview() {
  return (
    <ViewerStatusPanel indicatorColor="#f59e0b" title="Loading component">
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
    </ViewerStatusPanel>
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

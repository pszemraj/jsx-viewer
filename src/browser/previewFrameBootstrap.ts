import type { ComponentType, ReactNode } from "react";
import {
  BROWSER_PREVIEW_MESSAGE_SOURCE,
  isPreviewFrameInitMessage,
  type PreviewFrameInitMessage,
  type PreviewFrameStatusMessage,
} from "./previewFrameDocument";

interface PreviewFrameState {
  readonly init: PreviewFrameInitMessage;
  readonly parentOrigin: string;
}

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

type PreviewFrameStatusType = PreviewFrameStatusMessage["type"];

function toMessage(value: unknown) {
  if (value instanceof Error) {
    return value.message;
  }

  return typeof value === "string" ? value : String(value);
}

function collectOrigins() {
  const origins = new Set([window.location.origin]);

  for (const entry of performance.getEntriesByType("resource")) {
    try {
      const url = new URL(entry.name);
      if (url.protocol === "http:" || url.protocol === "https:") {
        origins.add(url.origin);
      }
    } catch {
      // Ignore non-URL resource names.
    }
  }

  return Array.from(origins).sort();
}

function postToParent(
  state: PreviewFrameState,
  type: PreviewFrameStatusType,
  message?: string,
) {
  parent.postMessage(
    {
      message,
      origins: collectOrigins(),
      source: BROWSER_PREVIEW_MESSAGE_SOURCE,
      type,
      version: state.init.version,
    },
    state.parentOrigin,
  );
}

function isSlotComponent(value: unknown) {
  if (typeof value === "function") {
    return true;
  }

  if (typeof value !== "object" || value === null) {
    return false;
  }

  const marker = (value as { $$typeof?: unknown }).$$typeof;
  return (
    marker === Symbol.for("react.forward_ref") ||
    marker === Symbol.for("react.lazy") ||
    marker === Symbol.for("react.memo")
  );
}

function waitForInitMessage(): Promise<PreviewFrameState> {
  return new Promise((resolve) => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== parent || !isPreviewFrameInitMessage(event.data)) {
        return;
      }

      window.removeEventListener("message", handleMessage);
      resolve({
        init: event.data,
        parentOrigin: event.origin,
      });
    };

    window.addEventListener("message", handleMessage);
  });
}

async function boot() {
  const state = await waitForInitMessage();
  const { init } = state;

  window.addEventListener("error", (event) => {
    postToParent(
      state,
      "runtime-error",
      toMessage(event.error ?? event.message ?? "Unknown runtime error"),
    );
  });
  window.addEventListener("unhandledrejection", (event) => {
    postToParent(state, "runtime-error", toMessage(event.reason));
  });

  try {
    const [React, { createRoot }, module] = await Promise.all([
      import(init.reactUrl) as Promise<typeof import("react")>,
      import(init.reactDomClientUrl) as Promise<typeof import("react-dom/client")>,
      import(init.artifactUrl) as Promise<{ default: unknown }>,
    ]);
    const Component = module.default;

    if (!isSlotComponent(Component)) {
      throw new Error("Loaded artifact must default-export a React component.");
    }

    const ErrorBoundary = class extends React.Component<
      ErrorBoundaryProps,
      ErrorBoundaryState
    > {
      constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { error: null };
      }

      static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { error };
      }

      componentDidCatch(error: Error) {
        postToParent(state, "runtime-error", toMessage(error));
      }

      render() {
        if (!this.state.error) {
          return this.props.children;
        }

        return React.createElement(
          "div",
          {
            style: {
              background: "#0a0a0a",
              color: "#f5f5f5",
              fontFamily: init.mono,
              minHeight: "100vh",
              padding: "32px",
            },
          },
          React.createElement(
            "div",
            { style: { margin: "0 auto", maxWidth: "720px" } },
            React.createElement(
              "h2",
              {
                style: {
                  color: "#fca5a5",
                  fontSize: "18px",
                  fontWeight: 500,
                  margin: "0 0 16px 0",
                },
              },
              "Render Error",
            ),
            React.createElement(
              "pre",
              {
                style: {
                  background: "#111",
                  border: "1px solid #333",
                  borderRadius: "8px",
                  color: "#ef4444",
                  fontFamily: init.mono,
                  fontSize: "13px",
                  lineHeight: 1.6,
                  margin: 0,
                  overflow: "auto",
                  padding: "20px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                },
              },
              toMessage(this.state.error),
            ),
          ),
        );
      }
    };

    const LoadingFallback = () =>
      React.createElement(
        "div",
        {
          style: {
            background: "#0a0a0a",
            color: "#ededed",
            fontFamily: init.mono,
            minHeight: "100vh",
            padding: "32px",
          },
        },
        React.createElement(
          "div",
          { style: { margin: "0 auto", maxWidth: "720px" } },
          React.createElement(
            "h2",
            {
              style: {
                fontSize: "18px",
                fontWeight: 500,
                margin: "0 0 12px 0",
              },
            },
            "Loading component",
          ),
          React.createElement(
            "p",
            {
              style: {
                color: "#888",
                fontSize: "13px",
                lineHeight: 1.6,
                margin: 0,
              },
            },
            "Waiting for the uploaded component to finish resolving.",
          ),
        ),
      );

    const rootElement = document.getElementById("root");
    if (!rootElement) {
      throw new Error("Preview frame root element was not found.");
    }

    const root = createRoot(rootElement);
    root.render(
      React.createElement(
        ErrorBoundary,
        null,
        React.createElement(
          React.Suspense,
          { fallback: React.createElement(LoadingFallback) },
          React.createElement(Component as ComponentType),
        ),
      ),
    );
    postToParent(state, "ready");
  } catch (error) {
    postToParent(state, "load-error", toMessage(error));
  }
}

void boot();

import { resolveRuntimeModuleUrl } from "./runtimeUrl";

interface PreviewFrameRuntimeModuleUrls {
  reactUrl: string;
  reactDomClientUrl: string;
}

interface BuildPreviewFrameDocumentOptions extends PreviewFrameRuntimeModuleUrls {
  artifactUrl: string;
  version: number;
}

const PREVIEW_MONO = '"JetBrains Mono", "Fira Code", "SF Mono", monospace';
const PREVIEW_MESSAGE_SOURCE = "jsx-viewer-browser-preview";

function getPreviewOrigin() {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

function getPreviewViteEnv() {
  return (
    import.meta as ImportMeta & {
      env?: { BASE_URL?: string; DEV?: boolean };
    }
  ).env;
}

function getRuntimeUrl(specifier: string) {
  const env = getPreviewViteEnv();
  const runtimeUrl = resolveRuntimeModuleUrl(specifier, {
    basePath: env?.BASE_URL,
    dev: env?.DEV,
    origin: getPreviewOrigin(),
  });

  if (!runtimeUrl) {
    throw new Error(`Missing browser runtime module URL for "${specifier}".`);
  }

  return runtimeUrl;
}

export function getPreviewFrameRuntimeModuleUrls(): PreviewFrameRuntimeModuleUrls {
  return {
    reactUrl: getRuntimeUrl("react"),
    reactDomClientUrl: getRuntimeUrl("react-dom/client"),
  };
}

export function buildPreviewFrameDocument({
  artifactUrl,
  reactDomClientUrl,
  reactUrl,
  version,
}: BuildPreviewFrameDocumentOptions) {
  const payload = JSON.stringify({
    artifactUrl,
    messageSource: PREVIEW_MESSAGE_SOURCE,
    mono: PREVIEW_MONO,
    reactDomClientUrl,
    reactUrl,
    version,
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body, #root {
        min-height: 100%;
      }

      html, body {
        margin: 0;
        background: #0a0a0a;
      }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      const preview = ${payload};
      const toMessage = (value) => {
        if (value instanceof Error) {
          return value.message;
        }

        return typeof value === "string" ? value : String(value);
      };
      const collectOrigins = () => {
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
      };
      const postToParent = (type, message) => {
        parent.postMessage(
          {
            message,
            origins: collectOrigins(),
            source: preview.messageSource,
            type,
            version: preview.version,
          },
          window.location.origin,
        );
      };
      const isSlotComponent = (value) => {
        if (typeof value === "function") {
          return true;
        }

        if (typeof value !== "object" || value === null) {
          return false;
        }

        const marker = value.$$typeof;
        return (
          marker === Symbol.for("react.forward_ref") ||
          marker === Symbol.for("react.lazy") ||
          marker === Symbol.for("react.memo")
        );
      };

      window.addEventListener("error", (event) => {
        postToParent(
          "runtime-error",
          toMessage(event.error ?? event.message ?? "Unknown runtime error"),
        );
      });
      window.addEventListener("unhandledrejection", (event) => {
        postToParent("runtime-error", toMessage(event.reason));
      });

      try {
        const [{ default: React }, { createRoot }, module] = await Promise.all([
          import(preview.reactUrl),
          import(preview.reactDomClientUrl),
          import(preview.artifactUrl),
        ]);
        const Component = module.default;

        if (!isSlotComponent(Component)) {
          throw new Error("Loaded artifact must default-export a React component.");
        }

        const ErrorBoundary = class extends React.Component {
          constructor(props) {
            super(props);
            this.state = { error: null };
          }

          static getDerivedStateFromError(error) {
            return { error };
          }

          componentDidCatch(error) {
            postToParent("runtime-error", toMessage(error));
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
                  fontFamily: preview.mono,
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
                      fontFamily: preview.mono,
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
                fontFamily: preview.mono,
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

        const root = createRoot(document.getElementById("root"));
        root.render(
          React.createElement(
            ErrorBoundary,
            null,
            React.createElement(
              React.Suspense,
              { fallback: React.createElement(LoadingFallback) },
              React.createElement(Component),
            ),
          ),
        );
        postToParent("ready");
      } catch (error) {
        postToParent("load-error", toMessage(error));
      }
    </script>
  </body>
</html>`;
}

export const BROWSER_PREVIEW_MESSAGE_SOURCE = PREVIEW_MESSAGE_SOURCE;

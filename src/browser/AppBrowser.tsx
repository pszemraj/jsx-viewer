import {
  useCallback,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { createLoadTracker } from "../loadTracker";
import {
  useArtifactDropZone,
  useArtifactFilePicker,
} from "../useArtifactInput";
import {
  MONO,
  SANS,
  toError,
} from "../viewerShared";
import {
  BrowserPreviewFrame,
  type BrowserPreviewArtifact,
} from "./BrowserPreviewFrame";
import { BROWSER_RUNTIME_DISPLAY_SPECIFIERS } from "./runtimeManifest";
import { transpileArtifact } from "./transpiler";

interface BrowserArtifactState {
  artifact: BrowserPreviewArtifact | null;
  error: Error | null;
  isLoading: boolean;
  status: string | null;
  version: number;
}

interface DropZoneProps {
  onContent: (content: string, name: string) => void;
}

interface ToolbarProps {
  filename: string | null;
  onClear: () => void;
  onSwap: (content: string, name: string) => void;
}

type BrowserShellView = "dropzone" | "error" | "preview";

export function getBrowserShellView(
  state: Pick<BrowserArtifactState, "artifact" | "error">,
): BrowserShellView {
  if (state.error) {
    return "error";
  }

  return state.artifact ? "preview" : "dropzone";
}

export function shouldShowLoadingOverlay(
  state: Pick<BrowserArtifactState, "artifact" | "isLoading" | "status">,
) {
  return state.artifact !== null && state.isLoading && state.status !== null;
}

function ErrorPanel({
  title,
  error,
  details,
}: {
  title: string;
  error: Error;
  details?: string;
}) {
  return (
    <div
      style={{
        padding: "32px",
        fontFamily: MONO,
        background: "#0a0a0a",
        minHeight: "calc(100vh - 49px)",
      }}
    >
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
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
              background: "#ef4444",
            }}
          />
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 500,
              color: "#f5f5f5",
            }}
          >
            {title}
          </h2>
        </div>
        <pre
          style={{
            background: "#111",
            border: "1px solid #333",
            borderRadius: "8px",
            padding: "20px",
            overflow: "auto",
            fontSize: "13px",
            lineHeight: 1.6,
            color: "#ef4444",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
          }}
        >
          {error.message}
        </pre>
        {details ? (
          <p
            style={{
              color: "#666",
              fontSize: "13px",
              marginTop: "16px",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {details}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LoadingState({
  status,
}: {
  status: string;
}) {
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
            {status}
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
          Browser mode compiles the artifact client-side, then boots it inside a
          dedicated preview frame on the same origin. This is a trusted-code
          path, not a sandbox.
        </p>
      </div>
    </div>
  );
}

function DropZone({ onContent }: DropZoneProps) {
  const {
    containerRef,
    fileInputRef,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    isDragging,
  } = useArtifactDropZone(onContent);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "calc(100vh - 49px)",
        background: "#0a0a0a",
        color: "#ededed",
        fontFamily: SANS,
        padding: "32px",
        outline: "none",
      }}
    >
      <div
        style={{
          border: `2px dashed ${isDragging ? "#0070f3" : "#333"}`,
          borderRadius: "12px",
          padding: "64px 48px",
          textAlign: "center",
          maxWidth: "720px",
          width: "100%",
          transition: "border-color 150ms ease",
          background: isDragging ? "rgba(0,112,243,0.04)" : "transparent",
        }}
      >
        <div
          style={{
            fontSize: "40px",
            marginBottom: "16px",
            opacity: 0.3,
            fontFamily: MONO,
          }}
        >
          {"</>"}
        </div>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 600,
            margin: "0 0 8px 0",
            letterSpacing: "-0.02em",
          }}
        >
          Drop, upload, or paste JSX/TSX
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#888",
            margin: "0 0 24px 0",
            lineHeight: 1.6,
          }}
        >
          GitHub Pages mode compiles the artifact in the browser and renders it
          directly inside this site. It supports trusted, single-file React 18
          components, browser-capable CDN package imports, and Tailwind utility
          classes.
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: "#111",
            color: "#ededed",
            border: "1px solid #333",
            borderRadius: "6px",
            padding: "8px 20px",
            fontSize: "13px",
            fontFamily: MONO,
            cursor: "pointer",
            transition: "background 150ms ease",
          }}
          onMouseEnter={(event: MouseEvent<HTMLButtonElement>) => {
            event.currentTarget.style.background = "#1a1a1a";
          }}
          onMouseLeave={(event: MouseEvent<HTMLButtonElement>) => {
            event.currentTarget.style.background = "#111";
          }}
        >
          upload artifact
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jsx,.tsx"
          onChange={handleFileSelect}
          style={{ display: "none" }}
        />
      </div>

      <div
        style={{
          marginTop: "40px",
          maxWidth: "720px",
          width: "100%",
          display: "grid",
          gap: "16px",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        <div
          style={{
            border: "1px solid #222",
            borderRadius: "10px",
            padding: "16px",
            background: "#050505",
          }}
        >
          <div style={{ color: "#f5f5f5", fontFamily: MONO, marginBottom: "8px" }}>
            browser-mode imports
          </div>
          <div
            style={{
              color: "#888",
              fontSize: "12px",
              lineHeight: 1.7,
              fontFamily: MONO,
              wordBreak: "break-word",
            }}
          >
            {BROWSER_RUNTIME_DISPLAY_SPECIFIERS.join(", ")}
            <br />
            other bare imports resolve through esm.sh
            <br />
            React 18 runtime modules stay local
          </div>
        </div>
        <div
          style={{
            border: "1px solid #222",
            borderRadius: "10px",
            padding: "16px",
            background: "#050505",
          }}
        >
          <div style={{ color: "#f5f5f5", fontFamily: MONO, marginBottom: "8px" }}>
            browser-mode limits
          </div>
          <div
            style={{
              color: "#888",
              fontSize: "12px",
              lineHeight: 1.7,
              fontFamily: MONO,
            }}
          >
            single file only
            <br />
            no relative imports
            <br />
            no Vite-only globals
            <br />
            trusted code only
          </div>
        </div>
      </div>
    </div>
  );
}

function Toolbar({ filename, onClear, onSwap }: ToolbarProps) {
  const { fileInputRef, handleFileSelect } = useArtifactFilePicker(onSwap);

  return (
    <div
      style={{
        height: "48px",
        borderBottom: "1px solid #222",
        background: "#0a0a0a",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        fontFamily: MONO,
        fontSize: "12px",
        gap: "12px",
        color: "#888",
        flexShrink: 0,
      }}
    >
      <span style={{ color: "#555", fontWeight: 600, letterSpacing: "0.05em" }}>
        JSX VIEWER
      </span>
      <span style={{ color: "#333" }}>|</span>
      <span
        style={{
          color: "#f59e0b",
          border: "1px solid #4b3604",
          borderRadius: "999px",
          padding: "2px 8px",
          background: "rgba(245, 158, 11, 0.08)",
        }}
      >
        browser mode
      </span>
      <span style={{ color: filename ? "#ededed" : "#555" }}>
        {filename ?? "no file loaded"}
      </span>
      <div style={{ flex: 1 }} />
      <span
        style={{ color: "#666" }}
        title="Loaded code runs in a dedicated preview frame on the same origin."
      >
        trusted artifact only
      </span>
      <button
        onClick={onClear}
        disabled={!filename}
        style={{
          background: "transparent",
          color: filename ? "#888" : "#444",
          border: "1px solid #333",
          borderRadius: "4px",
          padding: "4px 10px",
          fontSize: "11px",
          fontFamily: MONO,
          cursor: filename ? "pointer" : "default",
        }}
        onMouseEnter={(event: MouseEvent<HTMLButtonElement>) => {
          if (!filename) {
            return;
          }
          event.currentTarget.style.color = "#f5f5f5";
          event.currentTarget.style.borderColor = "#666";
        }}
        onMouseLeave={(event: MouseEvent<HTMLButtonElement>) => {
          event.currentTarget.style.color = filename ? "#888" : "#444";
          event.currentTarget.style.borderColor = "#333";
        }}
        title={
          filename
            ? "Return to the empty drop/upload/paste state"
            : "No file loaded"
        }
      >
        clear
      </button>
      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          background: "#111",
          color: "#888",
          border: "1px solid #333",
          borderRadius: "4px",
          padding: "4px 10px",
          fontSize: "11px",
          fontFamily: MONO,
          cursor: "pointer",
        }}
        onMouseEnter={(event: MouseEvent<HTMLButtonElement>) => {
          event.currentTarget.style.color = "#ededed";
          event.currentTarget.style.borderColor = "#555";
        }}
        onMouseLeave={(event: MouseEvent<HTMLButtonElement>) => {
          event.currentTarget.style.color = "#888";
          event.currentTarget.style.borderColor = "#333";
        }}
      >
        swap file
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".jsx,.tsx"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}

export default function AppBrowser() {
  const loadTrackerRef = useRef(createLoadTracker());
  const previewVersionRef = useRef(0);
  const [filename, setFilename] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);
  const [state, setState] = useState<BrowserArtifactState>({
    artifact: null,
    error: null,
    isLoading: false,
    status: null,
    version: 0,
  });

  const bumpPreviewVersion = useCallback(() => {
    previewVersionRef.current += 1;
    return previewVersionRef.current;
  }, []);

  const resetToEmpty = useCallback(() => {
    loadTrackerRef.current.begin();
    setFilename(null);
    setRuntimeError(null);
    const nextVersion = bumpPreviewVersion();
    setState({
      artifact: null,
      error: null,
      isLoading: false,
      status: null,
      version: nextVersion,
    });
  }, [bumpPreviewVersion]);

  const loadArtifact = useCallback(
    async (content: string, name: string) => {
      const loadToken = loadTrackerRef.current.begin();
      const loadingVersion = bumpPreviewVersion();
      setFilename(name);
      setRuntimeError(null);
      setState({
        artifact: null,
        error: null,
        isLoading: true,
        status: "Compiling artifact in the browser",
        version: loadingVersion,
      });

      try {
        const { code, features } = await transpileArtifact(content, name);

        if (!loadTrackerRef.current.isCurrent(loadToken)) {
          return;
        }

        const artifactVersion = bumpPreviewVersion();
        setState({
          artifact: {
            code,
            enableTailwindRuntime: features.enableTailwindRuntime,
            filename: name,
            version: artifactVersion,
          },
          error: null,
          isLoading: true,
          status: "Booting preview frame",
          version: artifactVersion,
        });
      } catch (error) {
        if (!loadTrackerRef.current.isCurrent(loadToken)) {
          return;
        }

        setState({
          artifact: null,
          error: toError(error),
          isLoading: false,
          status: null,
          version: bumpPreviewVersion(),
        });
      }
    },
    [bumpPreviewVersion],
  );

  const browserModeDetails =
    "This mode runs the loaded component inside a dedicated preview frame on the same origin. " +
    "That lets clear and swap fully tear down module-scope state, but it is still a trusted-code path rather than a security sandbox. " +
    "Relative imports, direct remote URL imports, Vite-only globals, and CommonJS are intentionally rejected early. " +
    "Bare package imports resolve through esm.sh, with React peer dependencies pinned to the viewer runtime, and class-heavy artifacts can load Tailwind's browser runtime.";
  const shellView = getBrowserShellView(state);
  const showLoadingOverlay = shouldShowLoadingOverlay(state);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#000",
      }}
    >
      <Toolbar
        filename={filename}
        onClear={resetToEmpty}
        onSwap={loadArtifact}
      />
      <div style={{ flex: 1, position: "relative" }}>
        {shellView === "error" ? (
          <ErrorPanel
            title="Browser Mode Error"
            error={state.error ?? new Error("Unknown browser-mode error.")}
            details={browserModeDetails}
          />
        ) : shellView === "dropzone" ? (
          <DropZone onContent={loadArtifact} />
        ) : state.artifact ? (
          <>
            {runtimeError ? (
              <div
                style={{
                  borderBottom: "1px solid #3a1b1b",
                  background: "rgba(127, 29, 29, 0.2)",
                  padding: "12px 16px",
                  color: "#fecaca",
                  fontFamily: MONO,
                  fontSize: "12px",
                  lineHeight: 1.6,
                }}
              >
                <strong style={{ color: "#fca5a5" }}>Uncaught runtime error:</strong>{" "}
                {runtimeError.message}
              </div>
            ) : null}
            <div style={{ minHeight: "calc(100vh - 49px)", position: "relative" }}>
              <BrowserPreviewFrame
                artifact={state.artifact}
                onLoadError={(version, error) => {
                  setRuntimeError(null);
                  setState((current) =>
                    current.version !== version
                      ? current
                      : {
                          artifact: null,
                          error,
                          isLoading: false,
                          status: null,
                          version: current.version,
                        },
                  );
                }}
                onReady={(version) => {
                  setRuntimeError(null);
                  setState((current) =>
                    current.version !== version
                      ? current
                      : {
                          ...current,
                          error: null,
                          isLoading: false,
                          status: null,
                        },
                  );
                }}
                onRuntimeError={(version, error) => {
                  setRuntimeError((current) =>
                    previewVersionRef.current === version ? error : current,
                  );
                }}
              />
              {showLoadingOverlay ? (
                <div
                  style={{
                    inset: 0,
                    pointerEvents: "none",
                    position: "absolute",
                  }}
                >
                  <LoadingState status={state.status ?? "Loading preview"} />
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

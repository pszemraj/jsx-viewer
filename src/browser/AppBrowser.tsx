import {
  useCallback,
  useEffect,
  useState,
  useRef,
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
import {
  collectContactedOrigins,
  runCorporatePreflight,
  type CorporatePreflightReport,
} from "./corporatePreflight";
import { BROWSER_RUNTIME_SPECIFIERS } from "./runtimeManifest";
import { transpileArtifact } from "./transpiler";

interface BrowserArtifactState {
  artifact: BrowserPreviewArtifact | null;
  error: Error | null;
  isLoading: boolean;
  status: string | null;
  version: number;
}

interface DropZoneProps {
  diagnostics: DiagnosticsState;
  onContent: (content: string, name: string) => void;
}

interface ToolbarProps {
  diagnostics: DiagnosticsState;
  diagnosticsOpen: boolean;
  filename: string | null;
  onClear: () => void;
  onToggleDiagnostics: () => void;
  onSwap: (content: string, name: string) => void;
}

interface DiagnosticsState {
  status: "checking" | "ready";
  report: CorporatePreflightReport | null;
  origins: string[];
}

type BrowserShellView = "dropzone" | "error" | "preview";

function createPreflightError(report: CorporatePreflightReport) {
  const lines = [...report.findings];

  if (report.origins.length > 0) {
    lines.push(`Observed origins: ${report.origins.join(", ")}`);
  }

  if (lines.length === 0) {
    lines.push("Managed-browser compatibility checks failed.");
  }

  return new Error(lines.join("\n"));
}

function mergeOrigins(...originGroups: readonly string[][]) {
  return Array.from(new Set(originGroups.flat())).sort();
}

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

function getDiagnosticsMeta(diagnostics: DiagnosticsState) {
  const isReady = diagnostics.status === "ready";
  const isBlocked = isReady && diagnostics.report !== null && !diagnostics.report.ok;

  return {
    isBlocked,
    accent: isBlocked ? "#ef4444" : isReady ? "#0cce6b" : "#f59e0b",
    border: isBlocked ? "#4b1d1d" : isReady ? "#17361f" : "#4b3604",
    background: isBlocked
      ? "rgba(127, 29, 29, 0.18)"
      : isReady
        ? "rgba(12, 206, 107, 0.08)"
        : "rgba(245, 158, 11, 0.08)",
    label: !isReady ? "checking" : isBlocked ? "attention" : "ready",
    headline: !isReady
      ? "Managed-browser diagnostics are still checking this browser."
      : isBlocked
        ? "This browser or policy is blocking a requirement for Pages mode."
        : "Managed-browser diagnostics passed.",
    summary: !isReady
      ? "Blob-backed ES module import support is still being probed."
      : isBlocked
        ? "Blob-backed ES module imports are unavailable here, so the dedicated browser preview frame cannot execute uploaded artifacts."
        : "Blob-backed imports are available. After initial load, this Pages app should only fetch same-origin runtime assets.",
  };
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

function DiagnosticsPanel({
  diagnostics,
  compact = false,
}: {
  diagnostics: DiagnosticsState;
  compact?: boolean;
}) {
  const meta = getDiagnosticsMeta(diagnostics);

  return (
    <div
      style={{
        borderTop: compact ? "1px solid #1f1f1f" : `1px solid ${meta.border}`,
        borderBottom: compact ? "1px solid #1f1f1f" : `1px solid ${meta.border}`,
        borderRadius: compact ? 0 : "10px",
        padding: compact ? "14px 16px" : "16px",
        background: compact ? "rgba(3, 8, 5, 0.96)" : meta.background,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: compact ? "6px" : "10px",
          fontFamily: MONO,
          color: "#f5f5f5",
          fontSize: compact ? "12px" : "13px",
        }}
      >
        <div
          style={{
            width: "10px",
            height: "10px",
            borderRadius: "50%",
            background: meta.accent,
            flexShrink: 0,
          }}
        />
        <strong>{compact ? "diagnostics" : meta.headline}</strong>
        {compact ? (
          <span style={{ color: "#777", textTransform: "uppercase", letterSpacing: "0.12em" }}>
            {meta.label}
          </span>
        ) : null}
      </div>
      <p
        style={{
          margin: 0,
          color: "#b5b5b5",
          fontSize: compact ? "12px" : "13px",
          lineHeight: 1.6,
          fontFamily: compact ? MONO : SANS,
        }}
      >
        {meta.summary}
      </p>
      {diagnostics.report?.findings.length ? (
        <pre
          style={{
            margin: "12px 0 0 0",
            padding: "12px",
            borderRadius: "8px",
            border: `1px solid ${meta.border}`,
            background: "rgba(0, 0, 0, 0.22)",
            color: "#fecaca",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: MONO,
            fontSize: "12px",
            lineHeight: 1.6,
          }}
        >
          {diagnostics.report.findings.join("\n")}
        </pre>
      ) : null}
      <details
        open={!compact && meta.isBlocked}
        style={{
          marginTop: "12px",
          color: "#d4d4d4",
          fontFamily: MONO,
          fontSize: "12px",
        }}
      >
        <summary style={{ cursor: "pointer" }}>
          observed origins ({diagnostics.origins.length})
        </summary>
        <div
          style={{
            marginTop: "8px",
            color: "#888",
            lineHeight: 1.7,
            wordBreak: "break-word",
          }}
        >
          {diagnostics.origins.length > 0
            ? diagnostics.origins.join(", ")
            : "No http(s) resource origins observed yet."}
        </div>
      </details>
    </div>
  );
}

function DiagnosticsToggle({
  diagnostics,
  isOpen,
  onToggle,
}: {
  diagnostics: DiagnosticsState;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const meta = getDiagnosticsMeta(diagnostics);

  return (
    <button
      onClick={onToggle}
      type="button"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        background: isOpen ? "rgba(255,255,255,0.05)" : "transparent",
        color: meta.isBlocked ? "#fca5a5" : "#777",
        border: `1px solid ${isOpen ? "#3a3a3a" : "#2a2a2a"}`,
        borderRadius: "999px",
        padding: "4px 10px",
        fontSize: "11px",
        fontFamily: MONO,
        cursor: "pointer",
      }}
      title="Show browser-mode diagnostics"
    >
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: meta.accent,
          flexShrink: 0,
        }}
      />
      diagnostics
      <span style={{ color: "#5d5d5d", textTransform: "uppercase", letterSpacing: "0.12em" }}>
        {meta.label}
      </span>
    </button>
  );
}

function DropZone({ diagnostics, onContent }: DropZoneProps) {
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
          components that import from the repo runtime allowlist.
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
            supported imports
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
            {BROWSER_RUNTIME_SPECIFIERS.join(", ")}
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
        {diagnostics.status === "ready" && diagnostics.report?.ok ? null : (
          <div
            style={{
              border: "1px solid #222",
              borderRadius: "10px",
              padding: "16px",
              background: "#050505",
            }}
          >
            <div style={{ color: "#f5f5f5", fontFamily: MONO, marginBottom: "8px" }}>
              browser checks
            </div>
            <div
              style={{
                color: "#888",
                fontSize: "12px",
                lineHeight: 1.7,
                fontFamily: MONO,
              }}
            >
              Use the toolbar diagnostics control if browser policies block this
              loader or you need origin/debug details.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Toolbar({
  diagnostics,
  diagnosticsOpen,
  filename,
  onClear,
  onToggleDiagnostics,
  onSwap,
}: ToolbarProps) {
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
      <DiagnosticsToggle
        diagnostics={diagnostics}
        isOpen={diagnosticsOpen}
        onToggle={onToggleDiagnostics}
      />
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
  const preflightPromiseRef = useRef<Promise<CorporatePreflightReport> | null>(
    null,
  );
  const [filename, setFilename] = useState<string | null>(null);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({
    status: "checking",
    report: null,
    origins: collectContactedOrigins(),
  });
  const [state, setState] = useState<BrowserArtifactState>({
    artifact: null,
    error: null,
    isLoading: false,
    status: null,
    version: 0,
  });

  useEffect(() => {
    if (diagnostics.status === "ready" && diagnostics.report && !diagnostics.report.ok) {
      setIsDiagnosticsOpen(true);
    }
  }, [diagnostics]);

  const refreshDiagnosticsOrigins = useCallback(() => {
    const origins = collectContactedOrigins();

    setDiagnostics((current) => {
      const mergedOrigins = mergeOrigins(current.origins, origins);
      const sameOrigins =
        current.origins.length === mergedOrigins.length &&
        current.origins.every((origin, index) => origin === mergedOrigins[index]);

      if (sameOrigins) {
        return current;
      }

      return {
        ...current,
        origins: mergedOrigins,
        report: current.report
          ? { ...current.report, origins: mergedOrigins }
          : null,
      };
    });
  }, []);

  const mergeDiagnosticsOrigins = useCallback((origins: readonly string[]) => {
    setDiagnostics((current) => {
      const mergedOrigins = mergeOrigins(current.origins, [...origins]);
      const sameOrigins =
        current.origins.length === mergedOrigins.length &&
        current.origins.every((origin, index) => origin === mergedOrigins[index]);

      if (sameOrigins) {
        return current;
      }

      return {
        ...current,
        origins: mergedOrigins,
        report: current.report
          ? { ...current.report, origins: mergedOrigins }
          : null,
      };
    });
  }, []);

  const ensurePreflight = useCallback(async () => {
    if (!preflightPromiseRef.current) {
      preflightPromiseRef.current = runCorporatePreflight().then((report) => {
        setDiagnostics({
          status: "ready",
          report,
          origins: report.origins,
        });
        return report;
      });
    }

    return preflightPromiseRef.current;
  }, []);

  useEffect(() => {
    void ensurePreflight();
  }, [ensurePreflight]);

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
    refreshDiagnosticsOrigins();
  }, [bumpPreviewVersion, refreshDiagnosticsOrigins]);

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
        status:
          diagnostics.status === "ready"
            ? "Compiling artifact in the browser"
            : "Checking managed-browser compatibility",
        version: loadingVersion,
      });

      try {
        const preflightReport = await ensurePreflight();

        if (!loadTrackerRef.current.isCurrent(loadToken)) {
          return;
        }

        if (!preflightReport.ok) {
          throw createPreflightError(preflightReport);
        }

        setState((current) => ({
          ...current,
          isLoading: true,
          status: "Compiling artifact in the browser",
        }));

        const { code } = await transpileArtifact(content, name);

        if (!loadTrackerRef.current.isCurrent(loadToken)) {
          return;
        }

        const artifactVersion = bumpPreviewVersion();
        setState({
          artifact: {
            code,
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
      } finally {
        refreshDiagnosticsOrigins();
      }
    },
    [
      bumpPreviewVersion,
      diagnostics.status,
      ensurePreflight,
      refreshDiagnosticsOrigins,
    ],
  );

  const browserModeDetails =
    "This mode runs the loaded component inside a dedicated preview frame on the same origin. " +
    "That lets clear and swap fully tear down module-scope state, but it is still a trusted-code path rather than a security sandbox. " +
    "Relative imports, remote URL imports, Vite-only globals, and CommonJS are intentionally rejected early. " +
    "Managed-browser diagnostics below show whether blob-backed module imports are allowed on this machine.";
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
        diagnostics={diagnostics}
        diagnosticsOpen={isDiagnosticsOpen}
        filename={filename}
        onClear={resetToEmpty}
        onToggleDiagnostics={() => setIsDiagnosticsOpen((current) => !current)}
        onSwap={loadArtifact}
      />
      {isDiagnosticsOpen ? (
        <DiagnosticsPanel diagnostics={diagnostics} compact />
      ) : null}
      <div style={{ flex: 1, position: "relative" }}>
        {shellView === "error" ? (
          <ErrorPanel
            title="Browser Mode Error"
            error={state.error ?? new Error("Unknown browser-mode error.")}
            details={browserModeDetails}
          />
        ) : shellView === "dropzone" ? (
          <DropZone diagnostics={diagnostics} onContent={loadArtifact} />
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
                onLoadError={(version, error, origins) => {
                  mergeDiagnosticsOrigins(origins);
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
                onReady={(version, origins) => {
                  mergeDiagnosticsOrigins(origins);
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
                onRuntimeError={(version, error, origins) => {
                  mergeDiagnosticsOrigins(origins);
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

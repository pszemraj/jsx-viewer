import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { SlotPreview } from "../SlotPreview";
import { createLoadTracker } from "../loadTracker";
import { isSlotComponent, type SlotComponent } from "../slotComponent";
import {
  collectContactedOrigins,
  runCorporatePreflight,
  type CorporatePreflightReport,
} from "./corporatePreflight";
import { BROWSER_RUNTIME_SPECIFIERS } from "./runtimeManifest";
import { transpileArtifact } from "./transpiler";

const MONO = '"JetBrains Mono", "Fira Code", "SF Mono", monospace';
const SANS = '"Inter", -apple-system, "Helvetica Neue", sans-serif';

interface BrowserArtifactState {
  Component: SlotComponent | null;
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
  filename: string | null;
  onClear: () => void;
  onSwap: (content: string, name: string) => void;
}

interface DiagnosticsState {
  status: "checking" | "ready";
  report: CorporatePreflightReport | null;
  origins: string[];
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function getFirstFile(files: FileList | null | undefined) {
  return files?.item(0) ?? null;
}

async function readArtifactFile(file: File) {
  return {
    content: await file.text(),
    name: file.name,
  };
}

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

function ErrorPanel({
  title,
  error,
  details,
  footer,
}: {
  title: string;
  error: Error;
  details?: string;
  footer?: ReactNode;
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
        {footer ? <div style={{ marginTop: "20px" }}>{footer}</div> : null}
      </div>
    </div>
  );
}

function LoadingState({
  status,
  footer,
}: {
  status: string;
  footer?: ReactNode;
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
          Browser mode compiles the artifact client-side, then imports it
          directly into this page. This is a trusted-code path, not a sandbox.
        </p>
        {footer ? <div style={{ marginTop: "20px" }}>{footer}</div> : null}
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
  const isReady = diagnostics.status === "ready";
  const isBlocked = isReady && diagnostics.report !== null && !diagnostics.report.ok;
  const accent = isBlocked ? "#ef4444" : isReady ? "#0cce6b" : "#f59e0b";
  const border = isBlocked ? "#4b1d1d" : isReady ? "#17361f" : "#4b3604";
  const background = isBlocked
    ? "rgba(127, 29, 29, 0.18)"
    : isReady
      ? "rgba(12, 206, 107, 0.08)"
      : "rgba(245, 158, 11, 0.08)";
  const headline = !isReady
    ? "managed-browser preflight in progress"
    : isBlocked
      ? "managed-browser policy blocked browser mode"
      : "managed-browser preflight passed";
  const summary = !isReady
    ? "Checking whether this browser/policy allows blob-backed ES module imports before artifact load."
    : isBlocked
      ? "Blob-backed ES module imports are unavailable here, so the direct-render Pages viewer cannot execute uploaded artifacts."
      : "Blob-backed imports are available. After initial load, this Pages app should only fetch same-origin runtime assets.";

  return (
    <div
      style={{
        border: `1px solid ${border}`,
        borderRadius: "10px",
        padding: compact ? "12px 14px" : "16px",
        background,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: compact ? "8px" : "10px",
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
            background: accent,
            flexShrink: 0,
          }}
        />
        <strong>{headline}</strong>
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
        {summary}
      </p>
      {diagnostics.report?.findings.length ? (
        <pre
          style={{
            margin: "12px 0 0 0",
            padding: "12px",
            borderRadius: "8px",
            border: `1px solid ${border}`,
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
        open={!compact && isBlocked}
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

function useGlobalRuntimeError(resetKey: number) {
  const [runtimeState, setRuntimeState] = useState<{
    error: Error | null;
    resetKey: number;
  }>({
    error: null,
    resetKey,
  });

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const message = event.error ?? event.message ?? "Unknown runtime error";
      setRuntimeState({ error: toError(message), resetKey });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      setRuntimeState({ error: toError(event.reason), resetKey });
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, [resetKey]);

  return runtimeState.resetKey === resetKey ? runtimeState.error : null;
}

function DropZone({ diagnostics, onContent }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      const artifact = await readArtifactFile(file);
      onContent(artifact.content, artifact.name);
    },
    [onContent],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);

      const file = getFirstFile(event.dataTransfer.files);
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile],
  );

  const handleFileSelect = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = getFirstFile(event.target.files);
      if (file) {
        void handleFile(file);
      }
      event.target.value = "";
    },
    [handleFile],
  );

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    const handlePasteEvent = (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData("text/plain");
      if (text?.trim()) {
        event.preventDefault();
        onContent(text, "pasted.tsx");
      }
    };

    window.addEventListener("paste", handlePasteEvent);
    return () => window.removeEventListener("paste", handlePasteEvent);
  }, [onContent]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
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
          maxWidth: "860px",
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
        <DiagnosticsPanel diagnostics={diagnostics} />
      </div>
    </div>
  );
}

function Toolbar({ filename, onClear, onSwap }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = getFirstFile(event.target.files);
      if (file) {
        const artifact = await readArtifactFile(file);
        onSwap(artifact.content, artifact.name);
      }
      event.target.value = "";
    },
    [onSwap],
  );

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
        title="Loaded code runs in the same page as the viewer."
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
  const artifactUrlRef = useRef<string | null>(null);
  const preflightPromiseRef = useRef<Promise<CorporatePreflightReport> | null>(
    null,
  );
  const [filename, setFilename] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({
    status: "checking",
    report: null,
    origins: collectContactedOrigins(),
  });
  const [state, setState] = useState<BrowserArtifactState>({
    Component: null,
    error: null,
    isLoading: false,
    status: null,
    version: 0,
  });

  const runtimeError = useGlobalRuntimeError(state.version);

  const refreshDiagnosticsOrigins = useCallback(() => {
    const origins = collectContactedOrigins();

    setDiagnostics((current) => {
      const sameOrigins =
        current.origins.length === origins.length &&
        current.origins.every((origin, index) => origin === origins[index]);

      if (sameOrigins) {
        return current;
      }

      return {
        ...current,
        origins,
        report: current.report ? { ...current.report, origins } : null,
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

  const disposeArtifactUrl = useCallback(() => {
    if (artifactUrlRef.current !== null) {
      URL.revokeObjectURL(artifactUrlRef.current);
      artifactUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      disposeArtifactUrl();
    };
  }, [disposeArtifactUrl]);

  useEffect(() => {
    void ensurePreflight();
  }, [ensurePreflight]);

  const resetToEmpty = useCallback(() => {
    loadTrackerRef.current.begin();
    disposeArtifactUrl();
    setFilename(null);
    setState((current) => ({
      ...current,
      Component: null,
      error: null,
      isLoading: false,
      status: null,
      version: current.version + 1,
    }));
    refreshDiagnosticsOrigins();
  }, [disposeArtifactUrl, refreshDiagnosticsOrigins]);

  const loadArtifact = useCallback(
    async (content: string, name: string) => {
      const loadToken = loadTrackerRef.current.begin();
      setFilename(name);
      setState((current) => ({
        ...current,
        Component: null,
        error: null,
        isLoading: true,
        status:
          diagnostics.status === "ready"
            ? "Compiling artifact in the browser"
            : "Checking managed-browser compatibility",
      }));

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

        setState((current) => ({
          ...current,
          isLoading: true,
          status: "Loading compiled module",
        }));

        const artifactUrl = URL.createObjectURL(
          new Blob([`${code}\n//# sourceURL=${name}.browser.js`], {
            type: "text/javascript",
          }),
        );

        try {
          const mod = (await import(
            /* @vite-ignore */ artifactUrl
          )) as { default?: unknown };

          if (!loadTrackerRef.current.isCurrent(loadToken)) {
            URL.revokeObjectURL(artifactUrl);
            return;
          }

          const component = mod.default;
          if (!isSlotComponent(component)) {
            throw new Error(
              "Loaded artifact must default-export a React component.",
            );
          }

          disposeArtifactUrl();
          artifactUrlRef.current = artifactUrl;

          setState((current) => ({
            ...current,
            Component: component,
            error: null,
            isLoading: false,
            status: null,
            version: current.version + 1,
          }));
        } catch (error) {
          URL.revokeObjectURL(artifactUrl);
          throw error;
        }
      } catch (error) {
        if (!loadTrackerRef.current.isCurrent(loadToken)) {
          return;
        }

        disposeArtifactUrl();
        setState((current) => ({
          ...current,
          Component: null,
          error: toError(error),
          isLoading: false,
          status: null,
          version: current.version + 1,
        }));
      } finally {
        refreshDiagnosticsOrigins();
      }
    },
    [diagnostics.status, disposeArtifactUrl, ensurePreflight, refreshDiagnosticsOrigins],
  );

  const browserModeDetails =
    "This mode renders the loaded component directly into the app shell. " +
    "That keeps the UX simple and avoids iframe boundaries, but it also means there is no security isolation. " +
    "Relative imports, remote URL imports, Vite-only globals, and CommonJS are intentionally rejected early. " +
    "Managed-browser diagnostics below show whether blob-backed module imports are allowed on this machine.";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#000",
      }}
    >
      <Toolbar filename={filename} onClear={resetToEmpty} onSwap={loadArtifact} />
      <div style={{ flex: 1, position: "relative" }}>
        {state.error ? (
          <ErrorPanel
            title="Browser Mode Error"
            error={state.error}
            details={browserModeDetails}
            footer={<DiagnosticsPanel diagnostics={diagnostics} compact />}
          />
        ) : state.isLoading && state.status ? (
          <LoadingState
            status={state.status}
            footer={<DiagnosticsPanel diagnostics={diagnostics} compact />}
          />
        ) : !state.Component ? (
          <DropZone diagnostics={diagnostics} onContent={loadArtifact} />
        ) : (
          <>
            <div style={{ padding: "16px 16px 0 16px" }}>
              <DiagnosticsPanel diagnostics={diagnostics} compact />
            </div>
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
            <SlotPreview Component={state.Component} version={state.version} />
          </>
        )}
      </div>
    </div>
  );
}

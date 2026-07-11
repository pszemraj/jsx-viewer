import { useCallback, useRef, useState } from "react";
import { createLoadTracker } from "../loadTracker";
import {
  useArtifactInput,
  type ArtifactInputController,
} from "../useArtifactInput";
import { createFileReadError, MONO, toError } from "../viewerShared";
import {
  ArtifactDropZone,
  VIEWER_CONTENT_MIN_HEIGHT,
  ViewerStatusPanel,
  ViewerToolbar,
} from "../viewerShell";
import {
  BrowserPreviewFrame,
  type BrowserPreviewArtifact,
} from "./BrowserPreviewFrame";
import { BROWSER_RUNTIME_DISPLAY_SPECIFIERS } from "./runtimeManifest";
import { transpileArtifact } from "./transpiler";

type BrowserArtifactState =
  | { view: "dropzone" }
  | { view: "error"; error: Error }
  | { view: "loading"; status: string }
  | {
      view: "preview";
      artifact: BrowserPreviewArtifact;
      status: string | null;
    };

interface DropZoneProps {
  handleArtifactFile: ArtifactInputController["handleArtifactFile"];
  openFilePicker: ArtifactInputController["openFilePicker"];
  submitText: ArtifactInputController["submitText"];
}

interface ToolbarProps {
  filename: string | null;
  fileInputRef: ArtifactInputController["fileInputRef"];
  handleFileSelect: ArtifactInputController["handleFileSelect"];
  onClear: () => void;
  openFilePicker: ArtifactInputController["openFilePicker"];
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
    <ViewerStatusPanel
      indicatorColor="#ef4444"
      maxWidth="860px"
      title={title}
      titleColor="#f5f5f5"
    >
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
    </ViewerStatusPanel>
  );
}

function LoadingState({ status }: { status: string }) {
  return (
    <ViewerStatusPanel indicatorColor="#f59e0b" title={status}>
      <p
        style={{
          color: "#888",
          fontSize: "13px",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        Browser mode compiles the artifact client-side, then boots it inside a
        dedicated preview frame on the same origin. This is a trusted-code path,
        not a sandbox.
      </p>
    </ViewerStatusPanel>
  );
}

function DropZone({
  handleArtifactFile,
  openFilePicker,
  submitText,
}: DropZoneProps) {
  return (
    <ArtifactDropZone
      description={
        <>
          GitHub Pages mode compiles the artifact in the browser and renders it
          directly inside this site. It supports trusted, single-file React 18
          components, browser-capable CDN package imports, and Tailwind utility
          classes.
        </>
      }
      descriptionLineHeight={1.6}
      details={
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
            <div
              style={{
                color: "#f5f5f5",
                fontFamily: MONO,
                marginBottom: "8px",
              }}
            >
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
            <div
              style={{
                color: "#f5f5f5",
                fontFamily: MONO,
                marginBottom: "8px",
              }}
            >
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
      }
      handleArtifactFile={handleArtifactFile}
      maxWidth="720px"
      openFilePicker={openFilePicker}
      submitText={submitText}
    />
  );
}

function Toolbar({
  filename,
  fileInputRef,
  handleFileSelect,
  onClear,
  openFilePicker,
}: ToolbarProps) {
  return (
    <ViewerToolbar
      context={
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
      }
      fileInputRef={fileInputRef}
      filename={filename}
      handleFileSelect={handleFileSelect}
      onClear={onClear}
      openFilePicker={openFilePicker}
      status={
        <span
          style={{ color: "#666" }}
          title="Loaded code runs in a dedicated preview frame on the same origin."
        >
          trusted artifact only
        </span>
      }
    />
  );
}

export default function AppBrowser() {
  const loadTrackerRef = useRef(createLoadTracker());
  const previewVersionRef = useRef(0);
  const [filename, setFilename] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<Error | null>(null);
  const [state, setState] = useState<BrowserArtifactState>({
    view: "dropzone",
  });

  const bumpPreviewVersion = useCallback(() => {
    previewVersionRef.current += 1;
    return previewVersionRef.current;
  }, []);

  const loadArtifact = useCallback(
    async (content: string, name: string) => {
      const loadToken = loadTrackerRef.current.begin();
      bumpPreviewVersion();
      setFilename(name);
      setRuntimeError(null);
      setState({
        view: "loading",
        status: "Compiling artifact in the browser",
      });

      try {
        const { code, features } = await transpileArtifact(content, name);

        if (!loadTrackerRef.current.isCurrent(loadToken)) {
          return;
        }

        const artifactVersion = bumpPreviewVersion();
        setState({
          view: "preview",
          artifact: {
            code,
            enableTailwindRuntime: features.enableTailwindRuntime,
            filename: name,
            version: artifactVersion,
          },
          status: "Booting preview frame",
        });
      } catch (error) {
        if (!loadTrackerRef.current.isCurrent(loadToken)) {
          return;
        }

        setState({ view: "error", error: toError(error) });
      }
    },
    [bumpPreviewVersion],
  );

  const handleFileReadError = useCallback(
    (readError: Error, file: File) => {
      loadTrackerRef.current.begin();
      bumpPreviewVersion();
      setFilename(file.name);
      setRuntimeError(null);
      setState({
        view: "error",
        error: createFileReadError(file.name, readError),
      });
    },
    [bumpPreviewVersion],
  );

  const {
    cancelPending,
    fileInputRef,
    handleArtifactFile,
    handleFileSelect,
    openFilePicker,
    submitText,
  } = useArtifactInput(loadArtifact, handleFileReadError);

  const resetToEmpty = useCallback(() => {
    cancelPending();
    loadTrackerRef.current.begin();
    setFilename(null);
    setRuntimeError(null);
    bumpPreviewVersion();
    setState({ view: "dropzone" });
  }, [bumpPreviewVersion, cancelPending]);

  const browserModeDetails =
    "This mode runs the loaded component inside a dedicated preview frame on the same origin. " +
    "That lets clear and swap fully tear down module-scope state, but it is still a trusted-code path rather than a security sandbox. " +
    "Relative imports, direct remote URL imports, Vite-only globals, and CommonJS are intentionally rejected early. " +
    "Bare package imports resolve through esm.sh, with React peer dependencies pinned to the viewer runtime, and class-heavy artifacts can load Tailwind's browser runtime.";
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
        fileInputRef={fileInputRef}
        handleFileSelect={handleFileSelect}
        onClear={resetToEmpty}
        openFilePicker={openFilePicker}
      />
      <div style={{ flex: 1, position: "relative" }}>
        {state.view === "error" ? (
          <ErrorPanel
            title="Browser Mode Error"
            error={state.error}
            details={browserModeDetails}
          />
        ) : state.view === "loading" ? (
          <LoadingState status={state.status} />
        ) : state.view === "dropzone" ? (
          <DropZone
            handleArtifactFile={handleArtifactFile}
            openFilePicker={openFilePicker}
            submitText={submitText}
          />
        ) : (
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
                <strong style={{ color: "#fca5a5" }}>
                  Uncaught runtime error:
                </strong>{" "}
                {runtimeError.message}
              </div>
            ) : null}
            <div
              style={{
                minHeight: VIEWER_CONTENT_MIN_HEIGHT,
                position: "relative",
              }}
            >
              <BrowserPreviewFrame
                artifact={state.artifact}
                onLoadError={(version, error) => {
                  setRuntimeError(null);
                  setState((current) =>
                    current.view !== "preview" ||
                    current.artifact.version !== version
                      ? current
                      : { view: "error", error },
                  );
                }}
                onReady={(version) => {
                  setRuntimeError(null);
                  setState((current) =>
                    current.view !== "preview" ||
                    current.artifact.version !== version
                      ? current
                      : {
                          ...current,
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
              {state.status !== null ? (
                <div
                  style={{
                    inset: 0,
                    pointerEvents: "none",
                    position: "absolute",
                  }}
                >
                  <LoadingState status={state.status} />
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

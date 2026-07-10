import { useCallback, useEffect, useRef, useState } from "react";
import { isSlotComponent, type SlotComponent } from "./slotComponent";
import { SlotPreview } from "./SlotPreview";
import {
  useArtifactInput,
  type ArtifactInputController,
} from "./useArtifactInput";
import { createFileReadError, MONO, toError } from "./viewerShared";
import {
  ArtifactDropZone,
  ViewerStatusPanel,
  ViewerToolbar,
} from "./viewerShell";
import {
  isServerMessage,
  type ClientMessage,
  type ServerMessage,
} from "../shared/protocol.mjs";
import { getWebSocketUrl } from "./runtimeConfig";
import { registerAfterUpdateReload } from "./hotReload";
import { createLoadTracker } from "./loadTracker";

// The viewer shell uses inline styles on purpose so its chrome stays isolated
// from the loaded artifact's Tailwind classes and any class-name collisions.
declare const __JSX_VIEWER_SLOT_MODULE_URL__: string;

interface LoadedComponentState {
  Component: SlotComponent | null;
  isPlaceholder: boolean;
  error: Error | null;
  version: number;
}

interface DropZoneProps {
  handleArtifactFile: ArtifactInputController["handleArtifactFile"];
  openFilePicker: ArtifactInputController["openFilePicker"];
  submitText: ArtifactInputController["submitText"];
}

interface ToolbarProps {
  filename: string | null;
  connected: boolean;
  fileInputRef: ArtifactInputController["fileInputRef"];
  handleFileSelect: ArtifactInputController["handleFileSelect"];
  onClear: () => void;
  openFilePicker: ArtifactInputController["openFilePicker"];
}

function useLoadedComponent() {
  const loadTrackerRef = useRef(createLoadTracker());
  const [state, setState] = useState<LoadedComponentState>({
    Component: null,
    isPlaceholder: true,
    error: null,
    version: 0,
  });

  const load = useCallback(async () => {
    const loadToken = loadTrackerRef.current.begin();

    try {
      const mod = (await import(
        /* @vite-ignore */ `${__JSX_VIEWER_SLOT_MODULE_URL__}?t=${Date.now()}`
      )) as { default?: unknown };
      const component = mod.default;

      if (!isSlotComponent(component)) {
        throw new Error(
          "Loaded artifact must default-export a React component.",
        );
      }

      // Ignore stale async completions so overlapping HMR reloads or StrictMode
      // effect replays cannot overwrite newer artifact state.
      if (!loadTrackerRef.current.isCurrent(loadToken)) {
        return;
      }

      setState((current) => ({
        Component: component,
        isPlaceholder: component.__isPlaceholder === true,
        error: null,
        version: current.version + 1,
      }));
    } catch (error) {
      if (!loadTrackerRef.current.isCurrent(loadToken)) {
        return;
      }

      setState((current) => ({
        ...current,
        error: toError(error),
      }));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return registerAfterUpdateReload(
      import.meta.hot,
      load,
      __JSX_VIEWER_SLOT_MODULE_URL__,
    );
  }, [load]);

  return state;
}

function useWebSocket(onMessage: (message: ServerMessage) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      const ws = new WebSocket(getWebSocketUrl(window.location));
      wsRef.current = ws;

      ws.onopen = () => {
        if (isMounted) {
          setConnected(true);
        }
      };

      ws.onclose = () => {
        if (!isMounted) {
          return;
        }

        setConnected(false);
        reconnectTimerRef.current = window.setTimeout(connect, 2000);
      };

      ws.onmessage = (event) => {
        try {
          const message: unknown = JSON.parse(event.data);
          if (isServerMessage(message)) {
            onMessage(message);
            return;
          }

          console.warn("[jsx-viewer] Ignoring malformed WS message.");
        } catch (error) {
          console.warn("[jsx-viewer] Bad WS message:", toError(error).message);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [onMessage]);

  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }

    console.warn(
      "[jsx-viewer] Cannot send message while WebSocket is disconnected.",
    );
    return false;
  }, []);

  return { send, connected };
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
          Drag a component in, click upload, or press Ctrl+V / Cmd+V to paste it
          immediately. Supports React 18, Tailwind, recharts, lucide-react, d3,
          three.js, chart.js, and more.
        </>
      }
      descriptionLineHeight={1.5}
      details={
        <div
          style={{
            marginTop: "48px",
            fontSize: "12px",
            color: "#555",
            fontFamily: MONO,
            textAlign: "center",
            lineHeight: 1.8,
          }}
        >
          <code>Upload JSX/TSX</code> &mdash; choose a local file
          <br />
          <code>Ctrl+V / Cmd+V</code> &mdash; paste from clipboard
          <br />
          <code>node bin/jsx-viewer.mjs file.tsx</code> &mdash; preload from CLI
          <br />
          <code>npm run dev -- --port 8080</code> &mdash; custom port
        </div>
      }
      handleArtifactFile={handleArtifactFile}
      maxWidth="520px"
      openFilePicker={openFilePicker}
      submitText={submitText}
    />
  );
}

function Toolbar({
  filename,
  connected,
  fileInputRef,
  handleFileSelect,
  onClear,
  openFilePicker,
}: ToolbarProps) {
  return (
    <ViewerToolbar
      fileInputRef={fileInputRef}
      filename={filename}
      handleFileSelect={handleFileSelect}
      identity={
        <span
          style={{ color: "#555", fontWeight: 600, letterSpacing: "0.05em" }}
        >
          JSX VIEWER
        </span>
      }
      onClear={onClear}
      openFilePicker={openFilePicker}
      status={
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: connected ? "#0cce6b" : "#666",
          }}
          title={connected ? "WebSocket connected" : "WebSocket disconnected"}
        />
      }
    />
  );
}

export default function App() {
  const { Component, isPlaceholder, error, version } = useLoadedComponent();
  const [filename, setFilename] = useState<string | null>(null);
  const [fileReadError, setFileReadError] = useState<Error | null>(null);

  const handleWsMessage = useCallback((message: ServerMessage) => {
    // The WebSocket echo updates the toolbar state; Vite's afterUpdate hook
    // performs the actual module reload once the slot write has been processed.
    setFilename(message.filename);
  }, []);

  const { send, connected } = useWebSocket(handleWsMessage);

  const handleContent = useCallback(
    (content: string, name: string) => {
      setFileReadError(null);
      if (send({ type: "load-artifact", content, filename: name })) {
        setFilename(name);
      }
    },
    [send],
  );

  const handleFileReadError = useCallback((readError: Error, file: File) => {
    setFilename(file.name);
    setFileReadError(createFileReadError(file.name, readError));
  }, []);

  const {
    cancelPending,
    fileInputRef,
    handleArtifactFile,
    handleFileSelect,
    openFilePicker,
    submitText,
  } = useArtifactInput(handleContent, handleFileReadError);

  const handleClear = useCallback(() => {
    cancelPending();
    setFileReadError(null);
    if (send({ type: "reset-slot" })) {
      setFilename(null);
    }
  }, [cancelPending, send]);

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
        connected={connected}
        fileInputRef={fileInputRef}
        handleFileSelect={handleFileSelect}
        onClear={handleClear}
        openFilePicker={openFilePicker}
      />
      <div style={{ flex: 1, position: "relative" }}>
        {fileReadError || error ? (
          <ViewerStatusPanel
            indicatorColor="#ef4444"
            title={fileReadError ? "File Read Error" : "Module Error"}
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
              }}
            >
              {(fileReadError ?? error)?.message}
            </pre>
            <p
              style={{
                color: "#666",
                fontSize: "13px",
                marginTop: "16px",
                lineHeight: 1.5,
              }}
            >
              {fileReadError
                ? "Choose or drop the file again after making sure it is still available."
                : "Fix the JSX/TSX file and save. Vite HMR will reload automatically."}
            </p>
          </ViewerStatusPanel>
        ) : isPlaceholder || !Component ? (
          <DropZone
            handleArtifactFile={handleArtifactFile}
            openFilePicker={openFilePicker}
            submitText={submitText}
          />
        ) : (
          <SlotPreview Component={Component} version={version} />
        )}
      </div>
    </div>
  );
}

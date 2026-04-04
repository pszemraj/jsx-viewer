import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { isSlotComponent, type SlotComponent } from "./slotComponent";
import { SlotPreview } from "./SlotPreview";
import {
  useArtifactDropZone,
  useArtifactFilePicker,
} from "./useArtifactInput";
import {
  MONO,
  SANS,
  toError,
} from "./viewerShared";
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
  onContent: (content: string, name: string) => void;
}

interface ToolbarProps {
  filename: string | null;
  connected: boolean;
  onClear: () => void;
  onSwap: (content: string, name: string) => void;
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
        throw new Error("Loaded artifact must default-export a React component.");
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
        version: current.version + 1,
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

  return { ...state, reload: load };
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

    console.warn("[jsx-viewer] Cannot send message while WebSocket is disconnected.");
    return false;
  }, []);

  return { send, connected };
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
          maxWidth: "520px",
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
            lineHeight: 1.5,
          }}
        >
          Drag a component in, click upload, or press Ctrl+V / Cmd+V to paste
          it immediately. Supports React 18, Tailwind, recharts, lucide-react,
          d3, three.js, chart.js, and more.
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
    </div>
  );
}

function Toolbar({ filename, connected, onClear, onSwap }: ToolbarProps) {
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
      <span style={{ color: filename ? "#ededed" : "#555" }}>
        {filename ?? "no file loaded"}
      </span>
      <div style={{ flex: 1 }} />
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: connected ? "#0cce6b" : "#666",
        }}
        title={connected ? "WebSocket connected" : "WebSocket disconnected"}
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

export default function App() {
  const { Component, isPlaceholder, error, version } = useLoadedComponent();
  const [filename, setFilename] = useState<string | null>(null);

  const handleWsMessage = useCallback(
    (message: ServerMessage) => {
      // The WebSocket echo updates the toolbar state; Vite's afterUpdate hook
      // performs the actual module reload once the slot write has been processed.
      setFilename(message.filename);
    },
    [],
  );

  const { send, connected } = useWebSocket(handleWsMessage);

  const handleContent = useCallback(
    (content: string, name: string) => {
      if (send({ type: "load-artifact", content, filename: name })) {
        setFilename(name);
      }
    },
    [send],
  );

  const handleClear = useCallback(() => {
    if (send({ type: "reset-slot" })) {
      setFilename(null);
    }
  }, [send]);

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
        onClear={handleClear}
        onSwap={handleContent}
      />
      <div style={{ flex: 1, position: "relative" }}>
        {error ? (
          <div
            style={{
              padding: "32px",
              fontFamily: MONO,
              background: "#0a0a0a",
              minHeight: "calc(100vh - 49px)",
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
                  Module Error
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
                }}
              >
                {error.message}
              </pre>
              <p
                style={{
                  color: "#666",
                  fontSize: "13px",
                  marginTop: "16px",
                  lineHeight: 1.5,
                }}
              >
                Fix the JSX/TSX file and save. Vite HMR will reload automatically.
              </p>
            </div>
          </div>
        ) : isPlaceholder || !Component ? (
          <DropZone onContent={handleContent} />
        ) : (
          <SlotPreview Component={Component} version={version} />
        )}
      </div>
    </div>
  );
}

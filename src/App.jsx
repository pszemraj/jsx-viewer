import { useState, useEffect, useCallback, useRef } from "react";
import { ErrorBoundary } from "./ErrorBoundary.jsx";

const MONO = '"JetBrains Mono", "Fira Code", "SF Mono", monospace';
const SANS = '"Inter", -apple-system, "Helvetica Neue", sans-serif';

function useLoadedComponent() {
  const [state, setState] = useState({
    Component: null,
    isPlaceholder: true,
    error: null,
    version: 0,
  });

  const load = useCallback(async () => {
    try {
      // Cache-bust via timestamp query to force re-evaluation
      const mod = await import(
        /* @vite-ignore */ `../component/View.jsx?t=${Date.now()}`
      );
      const Comp = mod.default;
      const isPlaceholder = Comp?.__isPlaceholder === true;
      setState((s) => ({
        Component: Comp,
        isPlaceholder,
        error: null,
        version: s.version + 1,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        error: err,
        version: s.version + 1,
      }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Listen for HMR updates on the component file
  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.on("vite:afterUpdate", () => {
        load();
      });
    }
  }, [load]);

  return { ...state, reload: load };
}

function useWebSocket(onMessage) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    function connect() {
      const protocol = location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${location.hostname}:3143`);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        // Reconnect after 2s
        setTimeout(connect, 2000);
      };
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          onMessage(msg);
        } catch (err) {
          console.warn("[jsx-viewer] Bad WS message:", err.message);
        }
      };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => wsRef.current?.close();
  }, [onMessage]);

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { send, connected };
}

function DropZone({ onContent }) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          onContent(evt.target.result, file.name);
        };
        reader.readAsText(file);
      }
    },
    [onContent],
  );

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  useEffect(() => {
    const handlePasteEvent = (event) => {
      const text = event.clipboardData?.getData("text/plain");
      if (text?.trim()) {
        event.preventDefault();
        onContent(text, "pasted.jsx");
      }
    };

    window.addEventListener("paste", handlePasteEvent);
    return () => window.removeEventListener("paste", handlePasteEvent);
  }, [onContent]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault();
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
          Drop a .jsx file here
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#888",
            margin: "0 0 24px 0",
            lineHeight: 1.5,
          }}
        >
          Drop a component, or press Ctrl+V / Cmd+V to paste it immediately.
          Supports React 18, Tailwind, recharts, lucide-react, d3, three.js,
          chart.js, and more.
        </p>
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
        <code>Ctrl+V / Cmd+V</code> &mdash; paste from clipboard
        <br />
        <code>node bin/jsx-viewer.mjs file.jsx</code> &mdash; preload from CLI
        <br />
        <code>npm run dev -- --port 8080</code> &mdash; custom port
      </div>
    </div>
  );
}

function Toolbar({ filename, connected, onSwap }) {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => onSwap(evt.target.result, file.name);
      reader.readAsText(file);
    }
  };

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
        {filename || "no file loaded"}
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
        onMouseEnter={(e) => {
          e.target.style.color = "#ededed";
          e.target.style.borderColor = "#555";
        }}
        onMouseLeave={(e) => {
          e.target.style.color = "#888";
          e.target.style.borderColor = "#333";
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
  const { Component, isPlaceholder, error, version, reload } =
    useLoadedComponent();
  const [filename, setFilename] = useState(null);

  const handleWsMessage = useCallback(
    (msg) => {
      if (msg.type === "file-updated") {
        setFilename(msg.filename || "external");
        // Vite HMR will trigger reload automatically via afterUpdate
        // but force a reload after a short delay as fallback
        setTimeout(reload, 300);
      }
    },
    [reload],
  );

  const { send, connected } = useWebSocket(handleWsMessage);

  const handleContent = useCallback(
    (content, name) => {
      send({ type: "load-jsx", content, filename: name });
      setFilename(name);
    },
    [send],
  );

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
                {error.message || String(error)}
              </pre>
              <p
                style={{
                  color: "#666",
                  fontSize: "13px",
                  marginTop: "16px",
                  lineHeight: 1.5,
                }}
              >
                Fix the JSX file and save. Vite HMR will reload automatically.
              </p>
            </div>
          </div>
        ) : isPlaceholder || !Component ? (
          <DropZone onContent={handleContent} />
        ) : (
          <ErrorBoundary key={version} resetKey={version}>
            <Component />
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}

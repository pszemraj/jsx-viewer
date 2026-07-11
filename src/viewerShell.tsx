import type { MouseEvent, ReactNode } from "react";
import {
  useArtifactDropZone,
  type ArtifactInputController,
} from "./useArtifactInput";
import { MONO, SANS } from "./viewerShared";

export const VIEWER_CONTENT_MIN_HEIGHT = "calc(100vh - 49px)";
const JSX_VIEWER_ISSUES_URL = "https://github.com/pszemraj/jsx-viewer/issues";

interface ArtifactDropZoneProps {
  description: ReactNode;
  descriptionLineHeight: number;
  details: ReactNode;
  handleArtifactFile: ArtifactInputController["handleArtifactFile"];
  maxWidth: string;
  openFilePicker: ArtifactInputController["openFilePicker"];
  submitText: ArtifactInputController["submitText"];
}

export function ArtifactDropZone({
  description,
  descriptionLineHeight,
  details,
  handleArtifactFile,
  maxWidth,
  openFilePicker,
  submitText,
}: ArtifactDropZoneProps) {
  const {
    containerRef,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    isDragging,
  } = useArtifactDropZone(handleArtifactFile, submitText);

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
        minHeight: VIEWER_CONTENT_MIN_HEIGHT,
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
          maxWidth,
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
            lineHeight: descriptionLineHeight,
          }}
        >
          {description}
        </p>
        <button
          onClick={openFilePicker}
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
      </div>
      {details}
    </div>
  );
}

interface ViewerToolbarProps {
  context?: ReactNode;
  fileInputRef: ArtifactInputController["fileInputRef"];
  filename: string | null;
  handleFileSelect: ArtifactInputController["handleFileSelect"];
  onClear: () => void;
  openFilePicker: ArtifactInputController["openFilePicker"];
  status: ReactNode;
}

export function ViewerToolbar({
  context,
  fileInputRef,
  filename,
  handleFileSelect,
  onClear,
  openFilePicker,
  status,
}: ViewerToolbarProps) {
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
      <a
        href={JSX_VIEWER_ISSUES_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Report an issue with jsx-viewer on GitHub"
        title="Report an issue with jsx-viewer on GitHub"
        style={{
          color: "#555",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textDecoration: "none",
        }}
        onMouseEnter={(event: MouseEvent<HTMLAnchorElement>) => {
          event.currentTarget.style.color = "#ededed";
        }}
        onMouseLeave={(event: MouseEvent<HTMLAnchorElement>) => {
          event.currentTarget.style.color = "#555";
        }}
      >
        JSX VIEWER
      </a>
      <span style={{ color: "#333" }}>|</span>
      {context}
      <span style={{ color: filename ? "#ededed" : "#555" }}>
        {filename ?? "no file loaded"}
      </span>
      <div style={{ flex: 1 }} />
      {status}
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
        onClick={openFilePicker}
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

interface ViewerStatusPanelProps {
  background?: string;
  children: ReactNode;
  indicatorColor: string;
  maxWidth?: string;
  minHeight?: string;
  title: ReactNode;
  titleColor?: string;
}

export function ViewerStatusPanel({
  background = "#0a0a0a",
  children,
  indicatorColor,
  maxWidth = "720px",
  minHeight = VIEWER_CONTENT_MIN_HEIGHT,
  title,
  titleColor,
}: ViewerStatusPanelProps) {
  return (
    <div
      style={{
        padding: "32px",
        fontFamily: MONO,
        background,
        color: "#f5f5f5",
        minHeight,
      }}
    >
      <div style={{ maxWidth, margin: "0 auto" }}>
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
              background: indicatorColor,
            }}
          />
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 500,
              color: titleColor,
            }}
          >
            {title}
          </h2>
        </div>
        {children}
      </div>
    </div>
  );
}

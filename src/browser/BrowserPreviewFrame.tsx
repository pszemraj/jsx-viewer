import { useEffect, useMemo, useRef } from "react";
import {
  BROWSER_PREVIEW_MESSAGE_SOURCE,
  buildPreviewFrameInitMessage,
  getPreviewFrameDocumentUrl,
  getPreviewFrameRuntimeModuleUrls,
  type PreviewFrameStatusMessage,
} from "./previewFrameDocument";

export interface BrowserPreviewArtifact {
  code: string;
  filename: string;
  version: number;
}

interface BrowserPreviewFrameProps {
  artifact: BrowserPreviewArtifact;
  onLoadError: (version: number, error: Error, origins: string[]) => void;
  onReady: (version: number, origins: string[]) => void;
  onRuntimeError: (version: number, error: Error, origins: string[]) => void;
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function toOrigins(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

export function BrowserPreviewFrame({
  artifact,
  onLoadError,
  onReady,
  onRuntimeError,
}: BrowserPreviewFrameProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const runtimeModuleUrls = useMemo(() => getPreviewFrameRuntimeModuleUrls(), []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const artifactUrl = URL.createObjectURL(
      new Blob([`${artifact.code}\n//# sourceURL=${artifact.filename}.browser.js`], {
        type: "text/javascript",
      }),
    );
    const initMessage = buildPreviewFrameInitMessage({
      artifactUrl,
      reactDomClientUrl: runtimeModuleUrls.reactDomClientUrl,
      reactUrl: runtimeModuleUrls.reactUrl,
      version: artifact.version,
    });
    const previewDocumentUrl = new URL(getPreviewFrameDocumentUrl());
    previewDocumentUrl.searchParams.set("preview-version", String(artifact.version));

    const handleLoad = () => {
      const frameWindow = frame.contentWindow;
      if (!frameWindow) {
        return;
      }

      frameWindow.postMessage(initMessage, window.location.origin);
    };

    frame.addEventListener("load", handleLoad);
    frame.src = previewDocumentUrl.toString();

    return () => {
      frame.removeEventListener("load", handleLoad);
      frame.src = "about:blank";
      URL.revokeObjectURL(artifactUrl);
    };
  }, [artifact, runtimeModuleUrls.reactDomClientUrl, runtimeModuleUrls.reactUrl]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<PreviewFrameStatusMessage>) => {
      if (event.source !== frameRef.current?.contentWindow) {
        return;
      }

      const data = event.data;
      if (
        !data ||
        data.source !== BROWSER_PREVIEW_MESSAGE_SOURCE ||
        data.version !== artifact.version
      ) {
        return;
      }

      const message = toError(data.message ?? "Unknown preview error");
      const origins = toOrigins(data.origins);

      if (data.type === "ready") {
        onReady(artifact.version, origins);
        return;
      }

      if (data.type === "load-error") {
        onLoadError(artifact.version, message, origins);
        return;
      }

      if (data.type === "runtime-error") {
        onRuntimeError(artifact.version, message, origins);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [artifact.version, onLoadError, onReady, onRuntimeError]);

  return (
    <iframe
      ref={frameRef}
      sandbox="allow-scripts allow-same-origin"
      style={{
        background: "#0a0a0a",
        border: 0,
        display: "block",
        height: "100%",
        minHeight: "calc(100vh - 49px)",
        width: "100%",
      }}
      title={`Browser preview for ${artifact.filename}`}
    />
  );
}

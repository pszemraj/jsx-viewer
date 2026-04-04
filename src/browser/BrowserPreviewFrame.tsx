import { useEffect, useMemo, useRef } from "react";
import {
  BROWSER_PREVIEW_MESSAGE_SOURCE,
  buildPreviewFrameInitMessage,
  getPreviewFrameDocumentUrl,
  getPreviewFrameRuntimeModuleUrls,
  type PreviewFrameStatusMessage,
} from "./previewFrameDocument";
import { toError } from "../viewerShared";

export interface BrowserPreviewArtifact {
  code: string;
  enableTailwindRuntime: boolean;
  filename: string;
  version: number;
}

interface BrowserPreviewFrameProps {
  artifact: BrowserPreviewArtifact;
  onLoadError: (version: number, error: Error) => void;
  onReady: (version: number) => void;
  onRuntimeError: (version: number, error: Error) => void;
}

interface BrowserPreviewFrameCallbacks {
  onLoadError: BrowserPreviewFrameProps["onLoadError"];
  onReady: BrowserPreviewFrameProps["onReady"];
  onRuntimeError: BrowserPreviewFrameProps["onRuntimeError"];
}

export function BrowserPreviewFrame({
  artifact,
  onLoadError,
  onReady,
  onRuntimeError,
}: BrowserPreviewFrameProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const callbacksRef = useRef<BrowserPreviewFrameCallbacks>({
    onLoadError,
    onReady,
    onRuntimeError,
  });
  const runtimeModuleUrls = useMemo(() => getPreviewFrameRuntimeModuleUrls(), []);

  useEffect(() => {
    callbacksRef.current = {
      onLoadError,
      onReady,
      onRuntimeError,
    };
  }, [onLoadError, onReady, onRuntimeError]);

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
      enableTailwindRuntime: artifact.enableTailwindRuntime,
      reactDomClientUrl: runtimeModuleUrls.reactDomClientUrl,
      reactUrl: runtimeModuleUrls.reactUrl,
      version: artifact.version,
    });
    const previewDocumentUrl = new URL(getPreviewFrameDocumentUrl());
    previewDocumentUrl.searchParams.set("preview-version", String(artifact.version));

    const handleMessage = (event: MessageEvent<PreviewFrameStatusMessage>) => {
      if (event.source !== frame.contentWindow) {
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

      const callbacks = callbacksRef.current;
      const message = toError(data.message ?? "Unknown preview error");

      if (data.type === "ready") {
        callbacks.onReady(artifact.version);
        return;
      }

      if (data.type === "load-error") {
        callbacks.onLoadError(artifact.version, message);
        return;
      }

      if (data.type === "runtime-error") {
        callbacks.onRuntimeError(artifact.version, message);
      }
    };

    const handleLoad = () => {
      const frameWindow = frame.contentWindow;
      if (!frameWindow) {
        return;
      }

      frameWindow.postMessage(initMessage, window.location.origin);
    };

    // Register the message listener before navigating the frame so fast
    // ready/load-error responses from a cached preview document are not missed.
    window.addEventListener("message", handleMessage);
    frame.addEventListener("load", handleLoad);
    frame.src = previewDocumentUrl.toString();

    return () => {
      window.removeEventListener("message", handleMessage);
      frame.removeEventListener("load", handleLoad);
      frame.src = "about:blank";
      URL.revokeObjectURL(artifactUrl);
    };
  }, [
    artifact,
    runtimeModuleUrls.reactDomClientUrl,
    runtimeModuleUrls.reactUrl,
  ]);

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

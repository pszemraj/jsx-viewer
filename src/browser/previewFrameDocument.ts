import { resolveBrowserBaseUrl } from "./basePath";
import { resolveRuntimeModuleUrl } from "./runtimeUrl";

export interface PreviewFrameRuntimeModuleUrls {
  readonly reactUrl: string;
  readonly reactDomClientUrl: string;
}

interface BuildPreviewFrameInitMessageOptions extends PreviewFrameRuntimeModuleUrls {
  readonly artifactUrl: string;
  readonly version: number;
}

export interface PreviewFrameInitMessage
  extends BuildPreviewFrameInitMessageOptions {
  readonly mono: string;
  readonly source: typeof PREVIEW_MESSAGE_SOURCE;
  readonly type: "init";
}

export interface PreviewFrameStatusMessage {
  readonly message?: string;
  readonly origins?: string[];
  readonly source: typeof PREVIEW_MESSAGE_SOURCE;
  readonly type: "load-error" | "ready" | "runtime-error";
  readonly version: number;
}

const PREVIEW_MONO = '"JetBrains Mono", "Fira Code", "SF Mono", monospace';
const PREVIEW_MESSAGE_SOURCE = "jsx-viewer-browser-preview";
const PREVIEW_FRAME_DOCUMENT_PATH = "preview-frame.html";

function getPreviewOrigin() {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

function getPreviewViteEnv() {
  return (
    import.meta as ImportMeta & {
      env?: { BASE_URL?: string; DEV?: boolean };
    }
  ).env;
}

export function getPreviewFrameDocumentUrl() {
  const env = getPreviewViteEnv();
  const baseUrl = resolveBrowserBaseUrl(getPreviewOrigin(), env?.BASE_URL);

  return new URL(PREVIEW_FRAME_DOCUMENT_PATH, baseUrl).toString();
}

function getRuntimeUrl(specifier: string) {
  const env = getPreviewViteEnv();
  const runtimeUrl = resolveRuntimeModuleUrl(specifier, {
    basePath: env?.BASE_URL,
    dev: env?.DEV,
    origin: getPreviewOrigin(),
  });

  if (!runtimeUrl) {
    throw new Error(`Missing browser runtime module URL for "${specifier}".`);
  }

  return runtimeUrl;
}

export function getPreviewFrameRuntimeModuleUrls(): PreviewFrameRuntimeModuleUrls {
  return {
    reactUrl: getRuntimeUrl("react"),
    reactDomClientUrl: getRuntimeUrl("react-dom/client"),
  };
}

export function buildPreviewFrameInitMessage({
  artifactUrl,
  reactDomClientUrl,
  reactUrl,
  version,
}: BuildPreviewFrameInitMessageOptions): PreviewFrameInitMessage {
  return {
    artifactUrl,
    mono: PREVIEW_MONO,
    reactDomClientUrl,
    reactUrl,
    source: PREVIEW_MESSAGE_SOURCE,
    type: "init",
    version,
  };
}

function isPreviewFrameRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isPreviewFrameInitMessage(
  value: unknown,
): value is PreviewFrameInitMessage {
  if (!isPreviewFrameRecord(value)) {
    return false;
  }

  return (
    typeof value.artifactUrl === "string" &&
    typeof value.mono === "string" &&
    typeof value.reactDomClientUrl === "string" &&
    typeof value.reactUrl === "string" &&
    value.source === PREVIEW_MESSAGE_SOURCE &&
    value.type === "init" &&
    typeof value.version === "number" &&
    Number.isFinite(value.version)
  );
}

export const BROWSER_PREVIEW_MESSAGE_SOURCE = PREVIEW_MESSAGE_SOURCE;

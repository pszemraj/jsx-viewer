import { resolveBrowserBaseUrl } from "./basePath";
import { resolveRuntimeModuleUrl } from "./runtimeUrl";

interface BrowserRuntimeViteEnv {
  BASE_URL?: string;
  DEV?: boolean;
}

function getBrowserRuntimeEnv() {
  return (import.meta as ImportMeta & { env?: BrowserRuntimeViteEnv }).env;
}

export function getBrowserRuntimeOrigin() {
  return typeof window === "undefined" ? "http://localhost" : window.location.origin;
}

export function resolveCurrentBrowserBaseUrl() {
  const env = getBrowserRuntimeEnv();
  return resolveBrowserBaseUrl(getBrowserRuntimeOrigin(), env?.BASE_URL);
}

export function resolveCurrentRuntimeModuleUrl(specifier: string) {
  const env = getBrowserRuntimeEnv();
  return resolveRuntimeModuleUrl(specifier, {
    basePath: env?.BASE_URL,
    dev: env?.DEV,
    origin: getBrowserRuntimeOrigin(),
  });
}

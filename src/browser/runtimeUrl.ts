import {
  getBrowserRuntimeModulePath,
  isBrowserRuntimeSpecifier,
} from "./runtimeManifest";
import { resolveBrowserBaseUrl } from "./basePath";

interface ResolveRuntimeModuleUrlOptions {
  readonly basePath?: string;
  readonly dev?: boolean;
  readonly origin: string;
}

export function resolveRuntimeModuleUrl(
  specifier: string,
  options: ResolveRuntimeModuleUrlOptions,
) {
  if (!isBrowserRuntimeSpecifier(specifier)) {
    return null;
  }

  const baseUrl = resolveBrowserBaseUrl(options.origin, options.basePath);
  const runtimeModulePath = getBrowserRuntimeModulePath(specifier, options.dev);
  return new URL(runtimeModulePath, baseUrl).toString();
}

import {
  getBrowserRuntimeModulePath,
  type BrowserRuntimeSpecifier,
} from "./runtimeManifest";
import { resolveBrowserBaseUrl } from "./basePath";

interface ResolveRuntimeModuleUrlOptions {
  readonly basePath?: string;
  readonly dev?: boolean;
  readonly origin: string;
}

export function resolveRuntimeModuleUrl(
  specifier: BrowserRuntimeSpecifier,
  options: ResolveRuntimeModuleUrlOptions,
) {
  const baseUrl = resolveBrowserBaseUrl(options.origin, options.basePath);
  const runtimeModulePath = getBrowserRuntimeModulePath(specifier, options.dev);
  return new URL(runtimeModulePath, baseUrl).toString();
}

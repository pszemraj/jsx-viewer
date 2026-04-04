import { BROWSER_RUNTIME_ENTRIES } from "./runtimeManifest";
import { resolveBrowserBaseUrl, stripLeadingSlash } from "./basePath";

interface ResolveRuntimeModuleUrlOptions {
  readonly basePath?: string;
  readonly dev?: boolean;
  readonly origin: string;
}

export function resolveRuntimeModuleUrl(
  specifier: string,
  options: ResolveRuntimeModuleUrlOptions,
) {
  const entry =
    BROWSER_RUNTIME_ENTRIES[specifier as keyof typeof BROWSER_RUNTIME_ENTRIES];

  if (!entry) {
    return null;
  }

  const baseUrl = resolveBrowserBaseUrl(options.origin, options.basePath);

  if (options.dev) {
    return new URL(stripLeadingSlash(entry.devPath), baseUrl).toString();
  }

  return new URL(`${entry.entryName}.js`, baseUrl).toString();
}

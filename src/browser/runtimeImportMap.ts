import {
  BROWSER_RUNTIME_SPECIFIERS,
  getBrowserRuntimeModulePath,
} from "./runtimeManifest";
import { normalizeBrowserBasePath } from "./basePath";

export function buildBrowserRuntimeImportMap(
  basePath: string | undefined,
  dev: boolean,
) {
  const normalizedBasePath = normalizeBrowserBasePath(basePath);
  const imports = Object.fromEntries(
    BROWSER_RUNTIME_SPECIFIERS.map((specifier) => [
      specifier,
      `${normalizedBasePath}${getBrowserRuntimeModulePath(specifier, dev)}`,
    ]),
  );

  return { imports };
}

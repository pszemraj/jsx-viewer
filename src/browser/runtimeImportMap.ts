import {
  BROWSER_RUNTIME_IMPORT_MAP_SPECIFIERS,
  BROWSER_RUNTIME_ENTRIES,
} from "./runtimeManifest";
import { normalizeBrowserBasePath, stripLeadingSlash } from "./basePath";

export function buildBrowserRuntimeImportMap(
  basePath: string | undefined,
  dev: boolean,
) {
  const normalizedBasePath = normalizeBrowserBasePath(basePath);
  const imports = Object.fromEntries(
    BROWSER_RUNTIME_IMPORT_MAP_SPECIFIERS.map((specifier) => {
      const entry = BROWSER_RUNTIME_ENTRIES[specifier];
      const pathname = dev
        ? stripLeadingSlash(entry.devPath)
        : `${entry.entryName}.js`;

      return [specifier, `${normalizedBasePath}${pathname}`];
    }),
  );

  return { imports };
}

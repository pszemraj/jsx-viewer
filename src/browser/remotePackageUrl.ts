import { BROWSER_RUNTIME_SPECIFIERS } from "./runtimeManifest";

const REMOTE_PACKAGE_CDN_ORIGIN = "https://esm.sh";
const REMOTE_PACKAGE_TARGET = "es2022";

export const BROWSER_REMOTE_PEER_DEPENDENCY_VERSIONS = {
  react: "18.3.1",
  "react-dom": "18.3.1",
} as const;

const REMOTE_PEER_DEPENDENCIES_QUERY = Object.entries(
  BROWSER_REMOTE_PEER_DEPENDENCY_VERSIONS,
)
  .map(([packageName, version]) => `${packageName}@${version}`)
  .join(",");

function invalidRemotePackageSpecifier(specifier: string) {
  return new Error(
    `Invalid bare package import "${specifier}" in browser mode. ` +
      'Use an npm package name such as "package" or "@scope/package".',
  );
}

export function resolveRemotePackageUrl(specifier: string) {
  const packageUrl = new URL(specifier, `${REMOTE_PACKAGE_CDN_ORIGIN}/`);

  if (
    specifier.trim() !== specifier ||
    specifier.includes("\\") ||
    packageUrl.origin !== REMOTE_PACKAGE_CDN_ORIGIN ||
    packageUrl.pathname === "/"
  ) {
    throw invalidRemotePackageSpecifier(specifier);
  }

  packageUrl.searchParams.set("target", REMOTE_PACKAGE_TARGET);
  packageUrl.searchParams.set("deps", REMOTE_PEER_DEPENDENCIES_QUERY);
  packageUrl.searchParams.set(
    "external",
    BROWSER_RUNTIME_SPECIFIERS.join(","),
  );
  return packageUrl.toString();
}

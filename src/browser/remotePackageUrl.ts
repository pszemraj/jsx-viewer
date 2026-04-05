const REMOTE_PACKAGE_CDN_ORIGIN = "https://esm.sh";
const REMOTE_PACKAGE_TARGET = "es2022";

export const BROWSER_REMOTE_EXTERNAL_SPECIFIERS = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
] as const;

export const BROWSER_REMOTE_PEER_DEPENDENCY_VERSIONS = {
  react: "18.3.1",
  "react-dom": "18.3.1",
} as const;

const REMOTE_PEER_DEPENDENCIES_QUERY = Object.entries(
  BROWSER_REMOTE_PEER_DEPENDENCY_VERSIONS,
)
  .map(([packageName, version]) => `${packageName}@${version}`)
  .join(",");

export function resolveRemotePackageUrl(specifier: string) {
  const packageUrl = new URL(specifier, `${REMOTE_PACKAGE_CDN_ORIGIN}/`);
  packageUrl.searchParams.set("target", REMOTE_PACKAGE_TARGET);
  packageUrl.searchParams.set("deps", REMOTE_PEER_DEPENDENCIES_QUERY);
  packageUrl.searchParams.set(
    "external",
    BROWSER_REMOTE_EXTERNAL_SPECIFIERS.join(","),
  );
  return packageUrl.toString();
}

const REMOTE_PACKAGE_CDN_ORIGIN = "https://esm.sh";
const REMOTE_PACKAGE_TARGET = "es2022";

export const BROWSER_REMOTE_EXTERNAL_SPECIFIERS = [
  "react",
  "react-dom",
  "react-dom/client",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
] as const;

export const BROWSER_REMOTE_PACKAGE_VERSIONS = {
  "chart.js": "4.5.1",
  d3: "7.9.0",
  lodash: "4.18.1",
  "lucide-react": "0.383.0",
  mathjs: "13.2.3",
  papaparse: "5.5.3",
  recharts: "2.15.4",
  three: "0.164.1",
  tone: "15.1.22",
} as const;

const SUPPORTED_BROWSER_REMOTE_PACKAGES = Object.keys(
  BROWSER_REMOTE_PACKAGE_VERSIONS,
).sort();

function parseRemotePackageSpecifier(specifier: string) {
  const pathSegments = specifier.split("/");

  if (specifier.startsWith("@")) {
    const packageName = pathSegments.slice(0, 2).join("/");
    const packageSubpath =
      pathSegments.length > 2 ? pathSegments.slice(2).join("/") : null;

    return {
      packageName,
      packageSubpath,
    };
  }

  const packageName = pathSegments[0] ?? specifier;
  const packageSubpath =
    pathSegments.length > 1 ? pathSegments.slice(1).join("/") : null;

  return {
    packageName,
    packageSubpath,
  };
}

export function resolveRemotePackageUrl(specifier: string) {
  const { packageName, packageSubpath } = parseRemotePackageSpecifier(specifier);
  const version =
    BROWSER_REMOTE_PACKAGE_VERSIONS[
      packageName as keyof typeof BROWSER_REMOTE_PACKAGE_VERSIONS
    ];

  if (!version) {
    throw new Error(
      `Unsupported bare import "${specifier}" in browser mode. ` +
        `Supported CDN-backed packages: ${SUPPORTED_BROWSER_REMOTE_PACKAGES.join(", ")}. ` +
        "Use the local Node/Vite viewer for custom packages.",
    );
  }

  const versionedSpecifier =
    packageSubpath === null
      ? `${packageName}@${version}`
      : `${packageName}@${version}/${packageSubpath}`;
  const packageUrl = new URL(versionedSpecifier, `${REMOTE_PACKAGE_CDN_ORIGIN}/`);
  packageUrl.searchParams.set("target", REMOTE_PACKAGE_TARGET);
  packageUrl.searchParams.set(
    "external",
    BROWSER_REMOTE_EXTERNAL_SPECIFIERS.join(","),
  );
  return packageUrl.toString();
}

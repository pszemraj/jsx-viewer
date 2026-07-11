import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BROWSER_REMOTE_PEER_DEPENDENCY_VERSIONS,
  resolveRemotePackageUrl,
} from "./remotePackageUrl";

const packageLock = JSON.parse(
  readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"),
) as {
  packages?: Record<string, { version?: string }>;
};

const expectedDepsQuery = Object.entries(BROWSER_REMOTE_PEER_DEPENDENCY_VERSIONS)
  .map(([packageName, version]) => `${packageName}@${version}`)
  .join(",");

test("browser remote peer versions stay aligned with the checked-in lockfile", () => {
  for (const [packageName, version] of Object.entries(
    BROWSER_REMOTE_PEER_DEPENDENCY_VERSIONS,
  )) {
    assert.equal(
      packageLock.packages?.[`node_modules/${packageName}`]?.version,
      version,
    );
  }
});

test("resolveRemotePackageUrl preserves subpaths, versions, and existing flags", () => {
  const packageUrl = new URL(
    resolveRemotePackageUrl("chart.js@4.4.3/auto?bundle=false"),
  );

  assert.equal(packageUrl.pathname, "/chart.js@4.4.3/auto");
  assert.equal(packageUrl.searchParams.get("bundle"), "false");
  assert.equal(packageUrl.searchParams.get("deps"), expectedDepsQuery);
});

test("resolveRemotePackageUrl supports scoped packages", () => {
  const packageUrl = new URL(resolveRemotePackageUrl("@radix-ui/react-dialog"));

  assert.equal(packageUrl.pathname, "/@radix-ui/react-dialog");
  assert.equal(packageUrl.searchParams.get("deps"), expectedDepsQuery);
});

test("resolveRemotePackageUrl cannot escape the esm.sh origin", () => {
  assert.throws(
    () => resolveRemotePackageUrl("\\\\example.com\\package"),
    /Invalid bare package import/,
  );
});

test("resolveRemotePackageUrl rejects specifiers without a package path", () => {
  for (const specifier of ["", ".", "#internal", "?flag", " package"] as const) {
    assert.throws(
      () => resolveRemotePackageUrl(specifier),
      /Invalid bare package import/,
    );
  }
});

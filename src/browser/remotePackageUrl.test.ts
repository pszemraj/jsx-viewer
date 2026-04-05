import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  BROWSER_REMOTE_EXTERNAL_SPECIFIERS,
  BROWSER_REMOTE_PACKAGE_VERSIONS,
  resolveRemotePackageUrl,
} from "./remotePackageUrl";

const packageLock = JSON.parse(
  readFileSync(new URL("../../package-lock.json", import.meta.url), "utf8"),
) as {
  packages?: Record<string, { version?: string }>;
};

test(
  "browser remote package versions stay aligned with the checked-in lockfile",
  () => {
    for (const [packageName, version] of Object.entries(
      BROWSER_REMOTE_PACKAGE_VERSIONS,
    )) {
      assert.equal(
        packageLock.packages?.[`node_modules/${packageName}`]?.version,
        version,
      );
    }
  },
);

test("resolveRemotePackageUrl pins supported packages to repo-tested versions", () => {
  const packageUrl = new URL(resolveRemotePackageUrl("lucide-react"));

  assert.equal(
    packageUrl.pathname,
    `/lucide-react@${BROWSER_REMOTE_PACKAGE_VERSIONS["lucide-react"]}`,
  );
  assert.equal(packageUrl.searchParams.get("target"), "es2022");
  assert.equal(
    packageUrl.searchParams.get("external"),
    BROWSER_REMOTE_EXTERNAL_SPECIFIERS.join(","),
  );
});

test("resolveRemotePackageUrl preserves package subpaths while pinning versions", () => {
  const packageUrl = new URL(resolveRemotePackageUrl("chart.js/auto"));

  assert.equal(
    packageUrl.pathname,
    `/chart.js@${BROWSER_REMOTE_PACKAGE_VERSIONS["chart.js"]}/auto`,
  );
});

test("resolveRemotePackageUrl rejects unsupported browser-mode packages", () => {
  assert.throws(
    () => resolveRemotePackageUrl("left-pad"),
    /Unsupported bare import "left-pad" in browser mode/,
  );
  assert.throws(
    () => resolveRemotePackageUrl("@babel/standalone"),
    /Supported CDN-backed packages:/,
  );
});

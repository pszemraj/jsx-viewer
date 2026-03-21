export const NODE_VERSION_REQUIREMENT = "Node 20.19.0+ or 22.12.0+";

function parseNodeVersion(versionText) {
  const match = /^v?(?<major>\d+)\.(?<minor>\d+)\.(?<patch>\d+)$/.exec(
    versionText,
  );

  if (!match?.groups) {
    return null;
  }

  return {
    major: Number.parseInt(match.groups.major, 10),
    minor: Number.parseInt(match.groups.minor, 10),
    patch: Number.parseInt(match.groups.patch, 10),
  };
}

export function isSupportedNodeVersion(versionText) {
  const version = parseNodeVersion(versionText);

  if (!version) {
    return false;
  }

  if (version.major === 20) {
    return version.minor > 19 || (version.minor === 19 && version.patch >= 0);
  }

  if (version.major === 22) {
    return version.minor > 12 || (version.minor === 12 && version.patch >= 0);
  }

  return version.major >= 23;
}

export function getUnsupportedNodeVersionMessage(versionText) {
  return `[jsx-viewer] Node ${versionText} is not supported. ${NODE_VERSION_REQUIREMENT} is required because Vite 8 sets that runtime floor.`;
}

export function assertSupportedNodeVersion(versionText) {
  if (!isSupportedNodeVersion(versionText)) {
    throw new Error(getUnsupportedNodeVersionMessage(versionText));
  }
}

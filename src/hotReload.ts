interface HotReloadUpdate {
  path: string;
  acceptedPath: string;
}

interface HotReloadUpdatePayload {
  updates: HotReloadUpdate[];
}

export interface HotReloadClient {
  on(
    event: "vite:afterUpdate",
    listener: (payload: HotReloadUpdatePayload) => void,
  ): void;
  off?(
    event: "vite:afterUpdate",
    listener: (payload: HotReloadUpdatePayload) => void,
  ): void;
}

function stripQueryAndHash(modulePath: string) {
  return modulePath.replace(/[?#].*$/, "");
}

export function didUpdateSlotModule(
  payload: HotReloadUpdatePayload,
  slotModuleUrl: string,
) {
  return payload.updates.some((update) => {
    const updatedPaths = [
      stripQueryAndHash(update.path),
      stripQueryAndHash(update.acceptedPath),
    ];
    return updatedPaths.includes(slotModuleUrl);
  });
}

export function registerAfterUpdateReload(
  hot: HotReloadClient | undefined,
  reload: () => void | Promise<void>,
  slotModuleUrl: string,
) {
  if (!hot) {
    return () => {};
  }

  const handleAfterUpdate = (payload: HotReloadUpdatePayload) => {
    // Limit artifact reloads to the slot module itself so in-repo shell edits
    // do not spuriously re-import the artifact during viewer development.
    if (didUpdateSlotModule(payload, slotModuleUrl)) {
      void reload();
    }
  };

  hot.on("vite:afterUpdate", handleAfterUpdate);

  return () => {
    hot.off?.("vite:afterUpdate", handleAfterUpdate);
  };
}

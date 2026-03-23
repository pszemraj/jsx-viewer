export interface HotReloadClient {
  on(event: "vite:afterUpdate", listener: () => void): void;
  off?(event: "vite:afterUpdate", listener: () => void): void;
}

export function registerAfterUpdateReload(
  hot: HotReloadClient | undefined,
  reload: () => void | Promise<void>,
) {
  if (!hot) {
    return () => {};
  }

  const handleAfterUpdate = () => {
    void reload();
  };

  hot.on("vite:afterUpdate", handleAfterUpdate);

  return () => {
    hot.off?.("vite:afterUpdate", handleAfterUpdate);
  };
}

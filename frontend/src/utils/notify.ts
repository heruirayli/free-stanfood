import { useSyncExternalStore } from "react";

// Error toasts (react-toastify), loaded the first time one is needed: most
// visits never show one, so the library stays out of the first download.
// Toasts sent before its container mounts are queued and shown once it does.

let wanted = false;
const listeners = new Set<() => void>();

export const notifyError = (message: string): void => {
  if (!wanted) {
    wanted = true;
    for (const listener of listeners) listener();
  }
  void import("react-toastify").then(({ toast }) => toast.error(message));
};

// Whether any toast has been asked for yet (App mounts the container then).
export const useToastsWanted = (): boolean =>
  useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => wanted,
    () => false,
  );

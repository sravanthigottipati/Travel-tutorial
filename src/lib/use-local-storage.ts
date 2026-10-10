"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "tt-local-storage-change";

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

export function useLocalStorageString(key: string): [string, (next: string) => void] {
  const value = useSyncExternalStore(subscribe, () => read(key), () => "");
  const set = useCallback(
    (next: string) => {
      try {
        localStorage.setItem(key, next);
      } catch {
        // storage blocked — the value just won't persist across visits
      }
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key]
  );
  return [value, set];
}

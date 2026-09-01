"use client";

import { useCallback, useSyncExternalStore } from "react";

const SIDEBAR_COLLAPSED_KEY = "mohasib_sidebar_collapsed";
const SIDEBAR_PREFERENCE_EVENT = "mohasib:sidebar-collapsed";

function getSnapshot() {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot() {
  return false;
}

function subscribe(onStoreChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_COLLAPSED_KEY) onStoreChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(SIDEBAR_PREFERENCE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, onStoreChange);
  };
}

/** Keeps the desktop sidebar preference across routes, refreshes, and sessions. */
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleCollapsed = useCallback(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(!getSnapshot()));
      window.dispatchEvent(new Event(SIDEBAR_PREFERENCE_EVENT));
    } catch {
      // localStorage can be unavailable in locked-down browsers.
    }
  }, []);

  return { collapsed, toggleCollapsed };
}

"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  defaultGlobalPeriod,
  GLOBAL_PERIOD_EVENT,
  GLOBAL_PERIOD_STORAGE_KEY,
  isGlobalPeriod,
  type GlobalPeriod,
} from "@/lib/global-period";

const DEFAULT_PERIOD_SERIALIZED = JSON.stringify(defaultGlobalPeriod());

function getSnapshot() {
  const stored = window.sessionStorage.getItem(GLOBAL_PERIOD_STORAGE_KEY);
  if (stored) return stored;
  const cookie = document.cookie
    .split("; ")
    .find((item) => item.startsWith(`${GLOBAL_PERIOD_STORAGE_KEY}=`))
    ?.slice(GLOBAL_PERIOD_STORAGE_KEY.length + 1);
  return cookie ? decodeURIComponent(cookie) : DEFAULT_PERIOD_SERIALIZED;
}

function subscribe(callback: () => void) {
  window.addEventListener(GLOBAL_PERIOD_EVENT, callback);
  return () => window.removeEventListener(GLOBAL_PERIOD_EVENT, callback);
}

export function useGlobalPeriod() {
  const serialized = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_PERIOD_SERIALIZED);
  const period = useMemo(() => {
    try {
      const parsed: unknown = JSON.parse(serialized);
      return isGlobalPeriod(parsed) ? parsed : defaultGlobalPeriod();
    } catch {
      return defaultGlobalPeriod();
    }
  }, [serialized]);

  const setPeriod = useCallback((next: GlobalPeriod) => {
    const serializedNext = JSON.stringify(next);
    window.sessionStorage.setItem(GLOBAL_PERIOD_STORAGE_KEY, serializedNext);
    document.cookie = `${GLOBAL_PERIOD_STORAGE_KEY}=${encodeURIComponent(serializedNext)}; Path=/; SameSite=Lax`;
    window.dispatchEvent(new Event(GLOBAL_PERIOD_EVENT));
  }, []);

  return { period, setPeriod };
}

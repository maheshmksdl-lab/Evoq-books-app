"use client";

import * as React from "react";

/** Reads initial URL search params after mount (avoids Suspense requirements of useSearchParams for static pages). */
export function useUrlParams(): URLSearchParams | null {
  const [p, setP] = React.useState<URLSearchParams | null>(null);
  React.useEffect(() => { setP(new URLSearchParams(window.location.search)); }, []);
  return p;
}

/** Small persisted UI preference in localStorage (per-viewer convenience only). */
export function useLocalPref<T>(key: string, initial: T): [T, (v: T) => void] {
  const [v, setV] = React.useState<T>(initial);
  React.useEffect(() => { try { const raw = localStorage.getItem(`evoq-books:${key}`); if (raw) setV(JSON.parse(raw) as T); } catch { /* ignore */ } }, [key]);
  const set = React.useCallback((n: T) => { setV(n); try { localStorage.setItem(`evoq-books:${key}`, JSON.stringify(n)); } catch { /* ignore */ } }, [key]);
  return [v, set];
}

"use client";

import * as React from "react";

/** SSR-safe media query hook (false on the server, correct after hydration). */
export function useMediaQuery(query: string): boolean {
  return React.useSyncExternalStore(
    (cb) => { const m = window.matchMedia(query); m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

"use client";

import * as React from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, THEMES, type ThemeId } from "@/lib/themes/themes";

interface ThemeCtx { theme: ThemeId; setTheme: (t: ThemeId) => void }
const Ctx = React.createContext<ThemeCtx>({ theme: DEFAULT_THEME, setTheme: () => {} });

const valid = (v: string | null): v is ThemeId => !!v && THEMES.some((t) => t.id === v);

/** Inline script (rendered in <head>) that applies the saved theme before first paint, avoiding a flash. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var ok=${JSON.stringify(THEMES.map((t) => t.id))};document.documentElement.setAttribute('data-theme',ok.indexOf(t)>-1?t:${JSON.stringify(DEFAULT_THEME)});}catch(e){document.documentElement.setAttribute('data-theme',${JSON.stringify(DEFAULT_THEME)});}})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeId>(DEFAULT_THEME);

  React.useEffect(() => {
    // Sync React state with what the init script already applied (avoids hydration mismatch).
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (valid(saved)) setThemeState(saved);
    } catch { /* storage unavailable — default theme stays */ }
  }, []);

  const setTheme = React.useCallback((t: ThemeId) => {
    setThemeState(t);
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_STORAGE_KEY, t); } catch { /* ignore */ }
  }, []);

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => React.useContext(Ctx);

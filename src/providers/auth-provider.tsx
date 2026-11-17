"use client";

// DEMO AUTHENTICATION — frontend only. There is no server, token, password reset or session security here.
// Credentials are checked in the browser against a salted-free SHA-256 digest purely so the demo password is not
// stored as plain text in the source. Anyone with the bundle can bypass this; do not treat it as real authentication.
import * as React from "react";

export const DEMO_ACCOUNT = {
  email: "demo@evoqbooks.example",
  username: "demo",
  name: "Meera Iyer",
  role: "Finance Manager",
  roleId: "role-finance",
  // SHA-256("<demo password>") — the password itself is published in the demo notice on the login page.
  passwordSha256: "0e7e06613db28dff38f35ecf618cb7c47c13bf5fde34ec5d98e2208646171202",
};
export const DEMO_PASSWORD_HINT = "EvoqDemo#2026";

export interface Session { email: string; name: string; role: string; at: string; remember: boolean }
const KEY = "evoq-books:session";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface AuthCtx {
  /** undefined while checking storage, null when signed out */
  session: Session | null | undefined;
  signIn: (identifier: string, password: string, remember: boolean) => Promise<{ ok: true } | { ok: false; error: string }>;
  signOut: () => void;
}
const Ctx = React.createContext<AuthCtx | null>(null);

function readSession(): Session | null {
  for (const store of [localStorage, sessionStorage]) {
    try { const raw = store.getItem(KEY); if (raw) return JSON.parse(raw) as Session; } catch { /* ignore */ }
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null | undefined>(undefined);
  React.useEffect(() => { setSession(readSession()); }, []);

  const signIn = React.useCallback<AuthCtx["signIn"]>(async (identifier, password, remember) => {
    await new Promise((r) => setTimeout(r, 700)); // simulated network latency so loading state is visible
    const id = identifier.trim().toLowerCase();
    if (!window.crypto?.subtle) return { ok: false, error: "This browser context cannot verify the demo password (HTTPS or localhost required)." };
    const okId = id === DEMO_ACCOUNT.email || id === DEMO_ACCOUNT.username;
    const okPw = (await sha256(password)) === DEMO_ACCOUNT.passwordSha256;
    if (!okId || !okPw) return { ok: false, error: "Invalid email/username or password. Check the demo credentials and try again." };
    const s: Session = { email: DEMO_ACCOUNT.email, name: DEMO_ACCOUNT.name, role: DEMO_ACCOUNT.role, at: new Date().toISOString(), remember };
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s)); } catch { /* storage blocked: session lives in memory */ }
    setSession(s);
    return { ok: true };
  }, []);

  const signOut = React.useCallback(() => {
    try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    setSession(null);
  }, []);

  const value = React.useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside <AuthProvider>");
  return c;
}

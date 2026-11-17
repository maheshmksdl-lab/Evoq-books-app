"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, BarChart3, Eye, EyeOff, FlaskConical, Loader2, Lock, Mail, ReceiptText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/sidebar";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DEMO_ACCOUNT, DEMO_PASSWORD_HINT, useAuth } from "@/providers/auth-provider";

const schema = z.object({ identifier: z.string().trim().min(1, "Enter your email or username"), password: z.string().min(1, "Enter your password"), remember: z.boolean() });
type Form = z.infer<typeof schema>;

function Illustration() {
  return (
    <svg viewBox="0 0 520 380" role="img" aria-label="Illustration of a financial dashboard with charts, a ledger and a coin stack" className="h-auto w-full max-w-md">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--t-action)" stopOpacity=".35" /><stop offset="1" stopColor="var(--t-action)" stopOpacity="0" /></linearGradient>
      </defs>
      <rect x="40" y="36" width="440" height="296" rx="20" fill="#fff" stroke="var(--n-border)" />
      <rect x="40" y="36" width="440" height="44" rx="20" fill="var(--t-surface)" />
      <rect x="40" y="62" width="440" height="18" fill="var(--t-surface)" />
      <circle cx="66" cy="58" r="5" fill="var(--t-soft)" /><circle cx="84" cy="58" r="5" fill="var(--t-soft)" /><circle cx="102" cy="58" r="5" fill="var(--t-soft)" />
      <rect x="64" y="100" width="118" height="64" rx="12" fill="var(--t-tint)" /><rect x="76" y="112" width="48" height="7" rx="3.5" fill="var(--t-soft)" /><rect x="76" y="130" width="84" height="14" rx="4" fill="var(--t-primary)" />
      <rect x="198" y="100" width="118" height="64" rx="12" fill="var(--t-surface)" stroke="var(--n-border)" /><rect x="210" y="112" width="48" height="7" rx="3.5" fill="var(--n-border)" /><rect x="210" y="130" width="70" height="14" rx="4" fill="var(--t-depth)" opacity=".85" />
      <rect x="332" y="100" width="124" height="64" rx="12" fill="var(--t-surface)" stroke="var(--n-border)" /><rect x="344" y="112" width="48" height="7" rx="3.5" fill="var(--n-border)" /><rect x="344" y="130" width="92" height="14" rx="4" fill="var(--t-action)" opacity=".8" />
      <path d="M64 296 L110 262 L156 274 L202 232 L248 246 L294 206 L340 220 L386 180 L432 194 L456 176 L456 296 Z" fill="url(#g1)" />
      <path d="M64 296 L110 262 L156 274 L202 232 L248 246 L294 206 L340 220 L386 180 L432 194 L456 176" fill="none" stroke="var(--t-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {[110, 202, 294, 386].map((x, i) => <circle key={x} cx={x} cy={[262, 232, 206, 180][i]} r="5" fill="#fff" stroke="var(--t-primary)" strokeWidth="2.5" />)}
      <g transform="translate(402 262)"><ellipse cx="46" cy="70" rx="42" ry="12" fill="var(--t-depth)" opacity=".12" />
        {[0, 1, 2].map((i) => <g key={i}><ellipse cx="46" cy={60 - i * 14} rx="34" ry="10" fill="var(--t-primary)" /><rect x="12" y={50 - i * 14} width="68" height="10" fill="var(--t-primary)" /><ellipse cx="46" cy={50 - i * 14} rx="34" ry="10" fill="var(--t-action)" /></g>)}</g>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter(); const { session, signIn } = useAuth();
  const [show, setShow] = React.useState(false); const [error, setError] = React.useState<string | null>(null); const [next, setNext] = React.useState("/dashboard");
  const { register, handleSubmit, setValue, setFocus, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { identifier: "", password: "", remember: true } });
  const [remember, setRemember] = React.useState(true);

  React.useEffect(() => { const n = new URLSearchParams(window.location.search).get("next"); if (n && n.startsWith("/") && !n.startsWith("//")) setNext(n); }, []);
  React.useEffect(() => { if (session) router.replace(next); }, [session, next, router]);
  React.useEffect(() => { setFocus("identifier"); }, [setFocus]);

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const r = await signIn(v.identifier, v.password, remember);
    if (!r.ok) { setError(r.error); setFocus("password"); return; }
    router.replace(next);
  });
  const fillDemo = () => { setValue("identifier", DEMO_ACCOUNT.email, { shouldValidate: true }); setValue("password", DEMO_PASSWORD_HINT, { shouldValidate: true }); setError(null); };

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="flex flex-col justify-between px-5 py-8 sm:px-10 lg:px-16">
        <div className=""><Logo tone="page" /></div>
        <div className="mx-auto w-full max-w-[400px] py-10">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to EVOQ Books to manage your accounts, banking and reports.</p>

          <div className="mt-5 rounded-lg border border-dashed border-soft bg-surface p-3 text-xs" role="note">
            <p className="flex items-center gap-1.5 font-semibold text-primary"><FlaskConical className="size-3.5" /> Demo environment</p>
            <p className="mt-1 text-muted-foreground">This is a frontend-only demo. Sign-in is simulated in your browser and is <b>not secure authentication</b>.</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5"><dt className="text-muted-foreground">Email</dt><dd className="tnum font-medium">{DEMO_ACCOUNT.email}</dd><dt className="text-muted-foreground">Password</dt><dd className="tnum font-medium">{DEMO_PASSWORD_HINT}</dd><dt className="text-muted-foreground">Role</dt><dd className="font-medium">{DEMO_ACCOUNT.role}</dd></dl>
            <Button type="button" size="xs" variant="outline" className="mt-2" onClick={fillDemo}>Fill demo credentials</Button>
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-5 space-y-4" aria-label="Sign in">
            {error && <div role="alert" className="tone-error flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</div>}
            <div className="space-y-1.5">
              <Label htmlFor="identifier">Email or username</Label>
              <div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="identifier" type="text" autoComplete="username" inputMode="email" placeholder="you@company.com" className="h-10 pl-9" aria-invalid={!!errors.identifier} aria-describedby={errors.identifier ? "identifier-err" : undefined} {...register("identifier")} /></div>
              {errors.identifier && <p id="identifier-err" role="alert" className="text-xs text-destructive">{errors.identifier.message}</p>}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><Link href="/forgot-password" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link></div>
              <div className="relative"><Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="password" type={show ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className="h-10 pl-9 pr-10" aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-err" : undefined} {...register("password")} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-1.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>
              {errors.password && <p id="password-err" role="alert" className="text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <div className="flex items-center gap-2"><Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(!!v)} /><Label htmlFor="remember" className="font-normal">Remember me <span className="text-muted-foreground">(stay signed in on this browser)</span></Label></div>
            <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="animate-spin" /> Signing in…</> : "Sign in"}</Button>
          </form>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" /> Demo build — no real accounts, data or passwords are involved.</p>
        </div>
        <p className="text-center text-[11px] text-muted-foreground">© 2026 EVOQ · EVOQ Books frontend demonstration</p>
      </section>

      <aside className="relative hidden flex-col justify-center gap-8 overflow-hidden border-l bg-[linear-gradient(160deg,var(--t-surface),var(--t-tint))] px-12 lg:flex" aria-hidden="false">
        <div className="mx-auto"><Illustration /></div>
        <div className="mx-auto max-w-md">
          <h2 className="text-xl font-semibold tracking-tight text-depth">Accounting that keeps every ledger in step</h2>
          <ul className="mt-4 space-y-3 text-sm text-foreground/80">
            <li className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm"><ReceiptText className="size-4" /></span><span><b className="block text-foreground">Double-entry, always balanced</b>Journals, receivables, payables and banking post to one set of books.</span></li>
            <li className="flex gap-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-primary shadow-sm"><BarChart3 className="size-4" /></span><span><b className="block text-foreground">Reports you can drill into</b>P&amp;L, balance sheet, cash flow and consolidation from the same data.</span></li>
          </ul>
          <div className="mt-6 flex items-center gap-3 rounded-xl border bg-white/80 p-3 shadow-sm"><div className="flex -space-x-2">{["Rohan Kulkarni", "Meera Iyer", "Kavita Rao", "Arjun Mehta"].map((n) => <UserAvatar key={n} name={n} size={30} className="ring-2 ring-white" />)}</div><p className="text-xs text-muted-foreground">Finance teams collaborate with roles, approvals and an audit trail.</p></div>
        </div>
      </aside>
    </main>
  );
}

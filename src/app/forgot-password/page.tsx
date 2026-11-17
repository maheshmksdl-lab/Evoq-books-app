"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FlaskConical, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/sidebar";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState(""); const [err, setErr] = React.useState<string | null>(null); const [busy, setBusy] = React.useState(false); const [sent, setSent] = React.useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErr("Enter a valid email address.");
    setBusy(true); await new Promise((r) => setTimeout(r, 800)); setBusy(false); setSent(true);
  };
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-10">
      <div className="mb-8 "><Logo tone="page" /></div>
      <div className="w-full max-w-[400px] rounded-xl border bg-card p-6 shadow-sm">
        {sent ? (
          <div className="text-center"><CheckCircle2 className="mx-auto mb-2 size-10 text-success" /><h1 className="text-lg font-semibold">Check your inbox</h1><p className="mt-1 text-sm text-muted-foreground">If an account exists for <b>{email}</b>, reset instructions would be sent.</p>
            <p className="tone-info mt-3 rounded-md border px-3 py-2 text-xs"><FlaskConical className="mr-1 inline size-3" /> Demo only — no email is sent and passwords cannot be reset.</p></div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <div><h1 className="text-lg font-semibold">Forgot your password?</h1><p className="mt-1 text-sm text-muted-foreground">Enter your email and we&apos;ll show how a reset would work.</p></div>
            <p className="tone-info rounded-md border px-3 py-2 text-xs"><FlaskConical className="mr-1 inline size-3" /> Demo only — no email delivery or password storage exists in this build.</p>
            <div className="space-y-1.5"><Label htmlFor="fp-email">Email</Label><div className="relative"><Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input id="fp-email" type="email" autoComplete="email" className="h-10 pl-9" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!err} /></div>{err && <p role="alert" className="text-xs text-destructive">{err}</p>}</div>
            <Button type="submit" className="h-10 w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Send reset link</Button>
          </form>
        )}
      </div>
      <Link href="/login" className="mt-5 inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowLeft className="size-3.5" /> Back to sign in</Link>
    </main>
  );
}

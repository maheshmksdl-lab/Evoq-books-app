"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { useApp } from "@/providers/app-provider";
import { useAuth } from "@/providers/auth-provider";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready } = useApp(); const { session } = useAuth(); const router = useRouter(); const pathname = usePathname();
  // Demo-only route guard: unauthenticated visitors are sent to /login (not real access control).
  React.useEffect(() => { if (session === null) router.replace(`/login?next=${encodeURIComponent(pathname)}`); }, [session, router, pathname]);
  if (!session) return <div className="min-h-dvh bg-background p-6"><Skeleton className="h-10 w-72" /><span className="sr-only">Checking session…</span></div>;
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a href="#main" className="sr-only z-50 rounded bg-card px-3 py-1.5 focus:not-sr-only focus:absolute focus:left-2 focus:top-2">Skip to content</a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main id="main" className="min-w-0 flex-1 overflow-y-auto bg-background p-3 sm:p-5 lg:p-7">
          {ready ? children : <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-28 w-full" /><Skeleton className="h-72 w-full" /></div>}
        </main>
      </div>
    </div>
  );
}

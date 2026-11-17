"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Route-level error boundary: a failing screen shows a recoverable message instead of blanking the whole app. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto mt-16 max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
      <div className="tone-error mx-auto mb-3 flex size-10 items-center justify-center rounded-full border"><AlertTriangle className="size-5" /></div>
      <h1 className="text-lg font-semibold">This screen hit a problem</h1>
      <p className="mt-1 text-sm text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
      <Button className="mt-4" onClick={reset}>Try again</Button>
    </div>
  );
}

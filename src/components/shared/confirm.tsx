"use client";

import * as React from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmOptions { title: string; description?: React.ReactNode; confirmLabel?: string; destructive?: boolean }
type Ask = (o: ConfirmOptions) => Promise<boolean>;
const Ctx = React.createContext<Ask>(async () => false);

/** Promise-based confirmation: `if (await confirm({ title: "Reverse journal?" })) …` */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const ask = React.useCallback<Ask>((o) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => { state?.resolve(v); setState(null); };
  return (
    <Ctx.Provider value={ask}>
      {children}
      <AlertDialog open={!!state} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{state?.title}</AlertDialogTitle>
            {state?.description && <AlertDialogDescription>{state.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction className={cn(state?.destructive && buttonVariants({ variant: "destructive" }), "")} onClick={() => close(true)}>{state?.confirmLabel ?? "Confirm"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Ctx.Provider>
  );
}
export const useConfirm = () => React.useContext(Ctx);

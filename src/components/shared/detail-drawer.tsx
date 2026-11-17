"use client";

import * as React from "react";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function DetailDrawer({ open, onOpenChange, title, description, children, footer, wide }: { open: boolean; onOpenChange: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn("flex w-full flex-col gap-0 p-0", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <SheetHeader className="border-b px-4 py-3"><SheetTitle className="text-base">{title}</SheetTitle>{description && <SheetDescription>{description}</SheetDescription>}</SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">{children}</div>
        {footer && <SheetFooter className="flex-row justify-end gap-2 border-t px-4 py-3">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { avatarFor, cleanName } from "@/lib/avatars";
import { formatDateTime, initials } from "@/lib/formatters";
import { cn } from "@/lib/utils";

/** Square-cropped, fixed-size profile photo with an initials fallback when the image is missing. */
export function UserAvatar({ name, size = 28, className }: { name: string; size?: number; className?: string }) {
  const n = cleanName(name);
  return (
    <Avatar className={cn("shrink-0 ring-1 ring-border", className)} style={{ width: size, height: size }}>
      <AvatarImage src={avatarFor(n)} alt={n} width={size} height={size} loading="lazy" className="object-cover" />
      <AvatarFallback className="bg-accent text-[10px] font-semibold text-accent-foreground">{initials(n)}</AvatarFallback>
    </Avatar>
  );
}

/** Avatar + name (optionally a second muted line) for table cells, timelines and cards. */
export function PersonCell({ name, sub, size = 24, className }: { name?: string | null; sub?: string; size?: number; className?: string }) {
  if (!name) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <UserAvatar name={name} size={size} />
      <span className="min-w-0 leading-tight"><span className="block truncate text-[13px]">{cleanName(name)}</span>{sub && <span className="block truncate text-[11px] text-muted-foreground">{sub}</span>}</span>
    </span>
  );
}

/** "<avatar> Name · 12 Nov 2026, 10:05" — used in timelines and audit sections. */
export function ByLine({ name, at, className }: { name: string; at?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-muted-foreground", className)}>
      <UserAvatar name={name} size={18} /><span>{cleanName(name)}</span>{at && <span>· {formatDateTime(at)}</span>}
    </span>
  );
}

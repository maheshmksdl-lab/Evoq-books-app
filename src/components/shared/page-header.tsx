"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { findNav } from "@/lib/nav";

export interface Crumb { label: string; href?: string }

export function PageHeader({ title, description, actions, trail, badge }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; trail?: Crumb[]; badge?: React.ReactNode }) {
  const pathname = usePathname();
  const { group, item } = findNav(pathname);
  const crumbs: Crumb[] = [];
  if (group && group.items) crumbs.push({ label: group.label });
  if (item) crumbs.push({ label: item.label, href: trail?.length ? item.href : undefined });
  if (trail) crumbs.push(...trail);
  return (
    <div className="no-print mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {crumbs.length > 0 && (
          <Breadcrumb className="mb-1">
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem><BreadcrumbLink asChild><Link href="/dashboard">Home</Link></BreadcrumbLink></BreadcrumbItem>
              {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {c.href && i < crumbs.length - 1 ? <BreadcrumbLink asChild><Link href={c.href}>{c.label}</Link></BreadcrumbLink> : <span className={i === crumbs.length - 1 ? "text-foreground" : ""}>{c.label}</span>}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
          {badge}
        </div>
        {description && <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
void BreadcrumbPage;

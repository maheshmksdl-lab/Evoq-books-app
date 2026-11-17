"use client";
import { PageHeader } from "@/components/shared/page-header";
import { DimensionManager } from "@/components/features/dimensions";
export default function Page() {
  return (<><PageHeader title="Projects" description="Project accounting: revenue and cost allocated to each project, profitability and budget utilisation." /><DimensionManager kind="project" /></>);
}

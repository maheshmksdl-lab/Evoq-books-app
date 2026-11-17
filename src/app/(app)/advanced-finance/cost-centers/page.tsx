"use client";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AllocationsPanel, DimensionManager } from "@/components/features/dimensions";
export default function Page() {
  return (<><PageHeader title="Departments & Cost Centers" description="Dimension-based accounting: tag journal lines and allocate shared costs, then report by department or cost center." />
    <Tabs defaultValue="cc"><TabsList><TabsTrigger value="cc">Cost centers</TabsTrigger><TabsTrigger value="dept">Departments</TabsTrigger><TabsTrigger value="alloc">Allocations</TabsTrigger></TabsList>
      <TabsContent value="cc" className="mt-3"><DimensionManager kind="costCenter" /></TabsContent><TabsContent value="dept" className="mt-3"><DimensionManager kind="department" /></TabsContent><TabsContent value="alloc" className="mt-3"><AllocationsPanel /></TabsContent></Tabs></>);
}

"use client";

import * as React from "react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Pencil, Plus, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FieldShell } from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { SimNotice } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm";
import { useEntityMutation, useRoles, useUsers } from "@/hooks/use-data";
import { services } from "@/services";
import { userSchema } from "@/lib/validators";
import { formatDateTime, initials } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { AppUser, PermissionAction, PermissionGroup, Role } from "@/types";

const GROUPS: { id: PermissionGroup; label: string }[] = [{ id: "dashboard", label: "Dashboard" }, { id: "accounts", label: "Accounts" }, { id: "journals", label: "Journals" }, { id: "banking", label: "Banking" }, { id: "receivables", label: "Receivables" }, { id: "payables", label: "Payables" }, { id: "expenses", label: "Expenses" }, { id: "tax", label: "Tax" }, { id: "reports", label: "Reports" }, { id: "settings", label: "Settings" }, { id: "approvals", label: "Approvals" }];
const ACTIONS: PermissionAction[] = ["view", "create", "edit", "delete", "approve"];
const empty = () => Object.fromEntries(GROUPS.map((g) => [g.id, [] as PermissionAction[]])) as Role["permissions"];

function PermissionMatrix({ role, onSave, onDelete }: { role: Role; onSave: (r: Role) => void; onDelete: () => void }) {
  const [perm, setPerm] = React.useState<Role["permissions"]>(role.permissions); const [name, setName] = React.useState(role.name); const [desc, setDesc] = React.useState(role.description);
  React.useEffect(() => { setPerm(role.permissions); setName(role.name); setDesc(role.description); }, [role]);
  const toggle = (g: PermissionGroup, a: PermissionAction) => setPerm((p) => { const cur = p[g] ?? []; const has = cur.includes(a); let next = has ? cur.filter((x) => x !== a) : [...cur, a]; if (!has && a !== "view" && !next.includes("view")) next = ["view", ...next]; if (has && a === "view") next = []; return { ...p, [g]: next }; });
  const dirty = JSON.stringify(perm) !== JSON.stringify(role.permissions) || name !== role.name || desc !== role.description;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2"><FieldShell label="Role name"><Input value={name} onChange={(e) => setName(e.target.value)} disabled={role.system} /></FieldShell><FieldShell label="Description"><Textarea rows={1} value={desc} onChange={(e) => setDesc(e.target.value)} /></FieldShell></div>
      <div className="scroll-thin overflow-x-auto rounded-lg border"><table className="w-full min-w-[520px] text-sm"><thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground"><tr><th className="px-3 py-1.5 text-left">Permission group</th>{ACTIONS.map((a) => <th key={a} className="w-20 px-2 py-1.5 text-center">{a}</th>)}</tr></thead>
        <tbody>{GROUPS.map((g) => <tr key={g.id} className="border-t"><td className="px-3 py-1.5 font-medium">{g.label}</td>{ACTIONS.map((a) => { const disabled = a === "approve" && !["approvals", "journals", "payables", "expenses"].includes(g.id); return <td key={a} className="px-2 py-1.5 text-center">{disabled ? <span className="text-muted-foreground/40">—</span> : <Checkbox checked={perm[g.id]?.includes(a)} onCheckedChange={() => toggle(g.id, a)} aria-label={`${role.name}: ${a} ${g.label}`} />}</td>; })}</tr>)}</tbody></table></div>
      <div className="flex justify-between gap-2"><div>{!role.system && <Button variant="outline" size="sm" onClick={onDelete}><Trash2 /> Delete role</Button>}</div><div className="flex items-center gap-2">{dirty && <span className="text-xs text-muted-foreground">Unsaved changes</span>}<Button size="sm" disabled={!dirty} onClick={() => onSave({ ...role, name, description: desc, permissions: perm })}>Save permissions</Button></div></div>
    </div>
  );
}

export default function UsersRolesPage() {
  const confirm = useConfirm(); const roles = useRoles(); const users = useUsers(); const [sel, setSel] = React.useState(""); const [inv, setInv] = React.useState<AppUser | "new" | null>(null); const [newRole, setNewRole] = React.useState(false);
  const rs = roles.data ?? []; const role = rs.find((r) => r.id === sel) ?? rs[0];
  const saveRole = useEntityMutation((e, r: { id?: string; name: string; description: string; permissions: Role["permissions"] }) => services.org.saveRole(e, r), { success: "Role permissions saved", invalidate: [["roles"]] });
  const delRole = useEntityMutation((e, id: string) => services.org.deleteRole(e, id), { success: "Role deleted", invalidate: [["roles"]], onDone: () => setSel("") });
  const saveUser = useEntityMutation((e, u: Partial<AppUser> & { name: string; email: string; roleId: string }) => services.org.saveUser(e, u), { success: (u) => (u.status === "invited" ? `Invitation to ${u.email} simulated — no email was sent` : "User updated") });
  const cols: Column<AppUser>[] = [
    { id: "n", header: "User", accessor: (u) => u.name, cell: (u) => <span className="flex items-center gap-2"><UserAvatar name={u.name} size={32} /><span><span className="block text-[13px] font-medium">{u.name}</span><span className="block text-[11px] text-muted-foreground">{u.email}</span></span></span> },
    { id: "r", header: "Role", accessor: (u) => rs.find((r) => r.id === u.roleId)?.name ?? "" }, { id: "s", header: "Status", accessor: (u) => u.status, cell: (u) => <StatusBadge status={u.status} /> }, { id: "l", header: "Last active", accessor: (u) => u.lastActive, cell: (u) => (u.lastActive ? formatDateTime(u.lastActive) : "—"), hideBelow: "md" },
  ];
  return (
    <>
      <PageHeader title="Users & Roles" description="Team members and the permission groups each role can use." />
      <SimNotice className="mb-3" title="UI simulation only">Roles shape what this frontend shows and which approval buttons are enabled. This is not secure server-side authorisation — there is no authentication in this build.</SimNotice>
      <Tabs defaultValue="users"><TabsList><TabsTrigger value="users">Users ({users.data?.length ?? 0})</TabsTrigger><TabsTrigger value="roles">Roles & permissions ({rs.length})</TabsTrigger></TabsList>
        <TabsContent value="users" className="mt-3"><div className="mb-2 flex justify-end"><Button size="sm" onClick={() => setInv("new")}><UserPlus /> Invite user</Button></div>
          <DataTable columns={cols} data={users.data ?? []} rowKey={(u) => u.id} isLoading={users.isLoading} hideSearch rowActions={[{ label: "Change role / edit", icon: Pencil, onClick: (u) => setInv(u) }, { label: "Disable user", icon: ShieldCheck, destructive: true, hidden: (u) => u.status === "disabled", onClick: async (u) => { if (await confirm({ title: `Disable ${u.name}?`, confirmLabel: "Disable", destructive: true })) saveUser.mutate({ ...u, status: "disabled" }); } }]} /></TabsContent>
        <TabsContent value="roles" className="mt-3"><div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="space-y-1">{rs.map((r) => <button key={r.id} onClick={() => setSel(r.id)} className={cn("w-full rounded-lg border px-3 py-2 text-left text-sm hover:bg-surface", role?.id === r.id && "border-action bg-accent/40")}><span className="font-medium">{r.name}</span>{r.system && <span className="ml-1.5 text-[10px] text-muted-foreground">built-in</span>}<span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">{r.description}</span></button>)}<Button variant="outline" size="sm" className="w-full" onClick={() => setNewRole(true)}><Plus /> New role</Button></div>
          {role && <div className="rounded-lg border bg-card p-3"><PermissionMatrix role={role} onSave={(r) => saveRole.mutate({ id: r.id, name: r.name, description: r.description, permissions: r.permissions })} onDelete={async () => { if (await confirm({ title: `Delete ${role.name}?`, destructive: true, confirmLabel: "Delete" })) delRole.mutate(role.id); }} /></div>}
        </div></TabsContent></Tabs>
      <FormDialog open={!!inv} onOpenChange={(o) => !o && setInv(null)} size="sm" title={inv && inv !== "new" ? `Edit ${inv.name}` : "Invite user"} description="Invitations are simulated — no email is sent." submitLabel={inv && inv !== "new" ? "Save" : "Send invite (simulated)"} schema={userSchema}
        fields={[{ name: "name", label: "Full name", required: true, span: 2 }, { name: "email", label: "Email", type: "email", required: true, span: 2 }, { name: "roleId", label: "Role", type: "select", options: rs.map((r) => ({ value: r.id, label: r.name })), required: true, span: 2 }]} defaultValues={inv && inv !== "new" ? { name: inv.name, email: inv.email, roleId: inv.roleId } : { name: "", email: "", roleId: "role-accountant" }}
        onSubmit={async (v: { name: string; email: string; roleId: string }) => { await saveUser.mutateAsync({ ...(inv && inv !== "new" ? inv : {}), ...v }); }} />
      <Dialog open={newRole} onOpenChange={setNewRole}><DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>New role</DialogTitle><DialogDescription>Starts with no permissions — grant them in the matrix.</DialogDescription></DialogHeader><NewRoleForm onCreate={async (name, description) => { await saveRole.mutateAsync({ name, description, permissions: empty() }); setNewRole(false); }} /><DialogFooter /></DialogContent></Dialog>
    </>
  );
}

function NewRoleForm({ onCreate }: { onCreate: (n: string, d: string) => Promise<void> }) {
  const [n, setN] = React.useState(""); const [d, setD] = React.useState(""); const [err, setErr] = React.useState("");
  return <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (!n.trim()) return setErr("Role name is required"); await onCreate(n.trim(), d); }}><FieldShell label="Role name" required error={err}><Input value={n} onChange={(e) => { setN(e.target.value); setErr(""); }} /></FieldShell><FieldShell label="Description"><Textarea rows={2} value={d} onChange={(e) => setD(e.target.value)} /></FieldShell><Button type="submit" className="w-full">Create role</Button></form>;
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Building2, X } from "lucide-react";
import { toast } from "sonner";
import { addDepartment, deleteDepartment, deleteEmployee, saveEmployee } from "@/lib/sic.functions";
import {
  employeesQuery,
  sicQuery,
  departmentsQuery,
  useRefresh,
  uploadFile,
  useIsAdmin,
} from "@/lib/data";
import { sicStatus } from "@/lib/sic";
import { PageHeader, PersonAvatar, Empty, Field, Panel, selectCls } from "@/components/sic-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/technicians")({
  validateSearch: (search: Record<string, unknown>): { q: string } => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Technicians — LEADS SIC" },
      { name: "description", content: "Register and manage technicians." },
      { property: "og:title", content: "Technicians — LEADS SIC" },
      { property: "og:description", content: "Register and manage technicians." },
    ],
  }),
  component: Technicians,
});

type Emp = Awaited<ReturnType<NonNullable<typeof employeesQuery.queryFn>>>[number];

function Technicians() {
  const emps = useQuery(employeesQuery).data ?? [];
  const sic = useQuery(sicQuery).data ?? [];
  const refresh = useRefresh();
  const { q: initialQ } = Route.useSearch();
  const [q, setQ] = useState(initialQ);
  const [editing, setEditing] = useState<Emp | "new" | null>(null);
  const [managingDepts, setManagingDepts] = useState(false);
  const isAdmin = useIsAdmin();
  const chips = ["border-t-coral", "border-t-teal", "border-t-sky", "border-t-sun"];

  async function remove(id: string) {
    if (!confirm("Delete this technician and all their SIC records?")) return;
    try {
      await deleteEmployee({ data: { id } });
    } catch (err) {
      toast.error((err as Error).message);
      return;
    }
    refresh();
  }

  const list = emps.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Technicians" subtitle={`${emps.length} registered`}>
        {isAdmin && (
          <Button variant="outline" onClick={() => setManagingDepts(true)}>
            <Building2 className="h-4 w-4" /> Departments
          </Button>
        )}
        {isAdmin && (
          <Button variant="hero" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add technician
          </Button>
        )}
      </PageHeader>
      <Input
        className="mb-4 max-w-sm bg-card"
        placeholder="Search technicians…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {list.length === 0 ? (
        <Panel>
          <Empty>No technicians found</Empty>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e, i) => {
            const mine = sic.filter(
              (r) => r.employee_id === e.id && sicStatus(r.expiry_date) !== "expired",
            );
            return (
              <div
                key={e.id}
                className={cn(
                  "rounded-2xl border border-t-4 bg-card p-4 shadow-card",
                  chips[i % 4],
                )}
              >
                <div className="flex items-center gap-3">
                  <PersonAvatar name={e.name} path={e.image_url} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{e.designation || "Technician"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                          e.status === "active"
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {e.status}
                      </span>
                      {e.department && (
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase text-primary">
                          {e.department.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-col">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(e)}
                        aria-label="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove(e.id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {mine.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No valid SIC</span>
                  ) : (
                    mine.map((r) => (
                      <span
                        key={r.id}
                        className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground"
                      >
                        {r.site?.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && (
        <EmpDialog emp={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
      {managingDepts && <DeptDialog onClose={() => setManagingDepts(false)} />}
    </div>
  );
}

function DeptDialog({ onClose }: { onClose: () => void }) {
  const depts = useQuery(departmentsQuery).data ?? [];
  const emps = useQuery(employeesQuery).data ?? [];
  const refresh = useRefresh();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await addDepartment({ data: { name: name.trim() } });
    } catch (err) {
      toast.error((err as Error).message);
      return;
    } finally {
      setBusy(false);
    }
    setName("");
    refresh();
  }

  async function remove(id: string, deptName: string) {
    const used = emps.filter((e) => e.department?.id === id).length;
    if (
      !confirm(
        used > 0
          ? `Delete "${deptName}"? ${used} technician(s) will keep no department.`
          : `Delete "${deptName}"?`,
      )
    )
      return;
    try {
      await deleteDepartment({ data: { id } });
    } catch (err) {
      toast.error((err as Error).message);
      return;
    }
    refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Departments</DialogTitle>
        </DialogHeader>
        <form onSubmit={add} className="flex gap-2">
          <Input
            placeholder="New department name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" variant="hero" disabled={busy || !name.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </form>
        <div className="mt-2 space-y-1">
          {depts.length === 0 && <Empty>No departments yet</Empty>}
          {depts.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-lg border bg-card px-3 py-2"
            >
              <span className="text-sm font-semibold">{d.name}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(d.id, d.name)}
                aria-label={`Delete ${d.name}`}
              >
                <X className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmpDialog({ emp, onClose }: { emp: Emp | null; onClose: () => void }) {
  const refresh = useRefresh();
  const depts = useQuery(departmentsQuery).data ?? [];
  const [name, setName] = useState(emp?.name ?? "");
  const [designation, setDesignation] = useState(emp?.designation ?? "Technician");
  const [status, setStatus] = useState(emp?.status ?? "active");
  const [departmentId, setDepartmentId] = useState(emp?.department_id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const image_url = file ? await uploadFile(file, "employees") : (emp?.image_url ?? null);
      const row = {
        name: name.trim(),
        designation,
        status,
        image_url,
        department_id: departmentId || null,
      };
      await saveEmployee({ data: { ...row, id: emp?.id } });
      toast.success("Saved");
      refresh();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{emp ? "Edit technician" : "Add technician"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <Field label="Name *">
            <Input required value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Designation">
              <Input value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </Field>
            <Field label="Department">
              <select
                className={selectCls}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">— None —</option>
                {depts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Status">
            <select
              className={selectCls}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <Field label="Photo">
            <Input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

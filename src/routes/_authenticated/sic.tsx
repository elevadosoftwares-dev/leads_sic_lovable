import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Download } from "lucide-react";
import { toast } from "sonner";
import { sitesQuery, sicQuery, employeesQuery, useRefresh, uploadFile, useIsAdmin, type SicRow } from "@/lib/data";
import { deleteSicRecord, saveSicRecords } from "@/lib/sic.functions";
import { fmtDate, sicStatus, downloadCsv } from "@/lib/sic";
import { PageHeader, Panel, PersonAvatar, StatusBadge, Empty, Field, FileLink, selectCls } from "@/components/sic-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/sic")({
  head: () => ({
    meta: [
      { title: "SIC Records — LEADS SIC" },
      { name: "description", content: "All registered safety induction course records." },
      { property: "og:title", content: "SIC Records — LEADS SIC" },
      { property: "og:description", content: "All registered safety induction course records." },
    ],
  }),
  component: SicPage,
});

const PAGE = 15;

function SicPage() {
  const sic = useQuery(sicQuery).data ?? [];
  const sites = useQuery(sitesQuery).data ?? [];
  const refresh = useRefresh();
  const [q, setQ] = useState("");
  const [site, setSite] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<SicRow | "new" | null>(null);
  const isAdmin = useIsAdmin();

  const rows = useMemo(
    () =>
      sic.filter(
        (r) =>
          (!site || r.site_id === site) &&
          (!status || sicStatus(r.expiry_date) === status) &&
          `${r.employee?.name} ${r.site?.name}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [sic, q, site, status],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);

  async function remove(id: string) {
    if (!confirm("Delete this SIC record?")) return;
    try {
      await deleteSicRecord({ data: { id } });
    } catch (err) { toast.error((err as Error).message); return; }
    toast.success("Deleted");
    refresh();
  }

  return (
    <div>
      <PageHeader title="SIC Records" subtitle={`${sic.length} safety induction records`}>
        <Button variant="outline" onClick={() => downloadCsv("sic-records.csv", [
          ["Site", "Employee", "Date of SIC", "Pass issued", "Expiry", "Status"],
          ...rows.map((r) => [r.site?.name ?? "", r.employee?.name ?? "", fmtDate(r.sic_date), r.pass_issued ? "Yes" : "No", fmtDate(r.expiry_date), sicStatus(r.expiry_date)]),
        ])}>
          <Download className="h-4 w-4" /> Export
        </Button>
        {isAdmin && <Button variant="hero" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Register SIC</Button>}
      </PageHeader>

      <Panel>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Input placeholder="Search name or site…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          <select className={selectCls} value={site} onChange={(e) => { setSite(e.target.value); setPage(0); }}>
            <option value="">All sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={selectCls} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All statuses</option>
            <option value="valid">Valid</option>
            <option value="expiring">Expiring in 30 days</option>
            <option value="expired">Expired</option>
          </select>
        </div>
        {shown.length === 0 ? <Empty>No records found</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-3 pr-3">Technician</th><th className="pr-3">Site</th><th className="pr-3">Date of SIC</th>
                  <th className="pr-3">Expiry</th><th className="pr-3">Pass</th><th className="pr-3">Status</th><th />
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <PersonAvatar name={r.employee?.name ?? "?"} fileId={r.employee?.image_id} />
                        <div><p className="font-semibold">{r.employee?.name}</p><FileLink fileId={r.attachment_id} /></div>
                      </div>
                    </td>
                    <td className="pr-3">{r.site?.name}</td>
                    <td className="pr-3">{fmtDate(r.sic_date)}</td>
                    <td className="pr-3">{fmtDate(r.expiry_date)}</td>
                    <td className="pr-3">{r.pass_issued ? "Yes" : "No"}</td>
                    <td className="pr-3"><StatusBadge expiry={r.expiry_date} /></td>
                    <td className="whitespace-nowrap text-right">
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => setEditing(r)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>}
                      {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove(r.id)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {rows.length ? page * PAGE + 1 : 0}–{Math.min(rows.length, (page + 1) * PAGE)} of {rows.length}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="px-2 py-1.5">{page + 1} / {pages}</span>
            <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </Panel>

      {editing && <SicDialog record={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SicDialog({ record, onClose, defaultSite }: { record: SicRow | null; onClose: () => void; defaultSite?: string }) {
  const sites = useQuery(sitesQuery).data ?? [];
  const emps = (useQuery(employeesQuery).data ?? []).filter((e) => e.status === "active" || e.id === record?.employee_id);
  const refresh = useRefresh();
  const [siteId, setSiteId] = useState(record?.site_id ?? defaultSite ?? "");
  const [selected, setSelected] = useState<string[]>(record ? [record.employee_id] : []);
  const [empQ, setEmpQ] = useState("");
  const [sicDate, setSicDate] = useState(record?.sic_date ?? "");
  const [pass, setPass] = useState(record?.pass_issued ?? true);
  const [expiry, setExpiry] = useState(record?.expiry_date ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!siteId || selected.length === 0 || !sicDate) { toast.error("Site, technician and date are required"); return; }
    setBusy(true);
    try {
      const attachment_id = file ? await uploadFile(file) : record?.attachment_id ?? null;
      await saveSicRecords({
        data: {
          ...(record && { id: record.id }),
          site_id: siteId,
          employee_ids: selected,
          sic_date: sicDate,
          pass_issued: pass,
          expiry_date: expiry || null,
          attachment_id,
        },
      });
      toast.success(record ? "SIC updated" : `${selected.length} SIC record(s) registered`);
      refresh();
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (id: string) =>
    setSelected((s) => (record ? [id] : s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{record ? "Edit SIC" : "Register SIC"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <Field label="Site *">
            <select className={selectCls} value={siteId} onChange={(e) => setSiteId(e.target.value)} required>
              <option value="">— Select site —</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label={record ? "Technician *" : `Technician(s) * — ${selected.length} selected`}>
            <Input placeholder="Search…" value={empQ} onChange={(e) => setEmpQ(e.target.value)} />
            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
              {emps.filter((e) => e.name.toLowerCase().includes(empQ.toLowerCase())).map((e) => (
                <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                  <input type={record ? "radio" : "checkbox"} checked={selected.includes(e.id)} onChange={() => toggle(e.id)} />
                  {e.name}
                </label>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date of SIC *"><Input type="date" value={sicDate} onChange={(e) => setSicDate(e.target.value)} required /></Field>
            <Field label="Expiry date"><Input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></Field>
          </div>
          <Field label="Pass issued *">
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" checked={pass} onChange={() => setPass(true)} /> Yes</label>
              <label className="flex items-center gap-2"><input type="radio" checked={!pass} onChange={() => setPass(false)} /> No</label>
            </div>
          </Field>
          <Field label="Attach file (optional)"><Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

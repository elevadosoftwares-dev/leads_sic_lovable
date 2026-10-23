import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Mail, Phone, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { bookingsQuery, sitesQuery, useRefresh, uploadFile, useIsAdmin } from "@/lib/data";
import { deleteBooking, saveBooking, type Booking } from "@/lib/bookings.functions";
import { PageHeader, Empty, Field, Panel, FileLink, selectCls } from "@/components/sic-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/bookings")({
  head: () => ({
    meta: [
      { title: "Booking Instructions — LEADS SIC" },
      { name: "description", content: "How to book SIC sessions at each client site." },
      { property: "og:title", content: "Booking Instructions — LEADS SIC" },
      { property: "og:description", content: "How to book SIC sessions at each client site." },
    ],
  }),
  component: Bookings,
});

function Bookings() {
  const list = useQuery(bookingsQuery).data ?? [];
  const refresh = useRefresh();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Booking | "new" | null>(null);
  const isAdmin = useIsAdmin();

  async function remove(id: string) {
    if (!confirm("Delete this booking instruction?")) return;
    try {
      await deleteBooking({ data: { id } });
    } catch (err) { toast.error((err as Error).message); return; }
    refresh();
  }

  const rows = list.filter((b) => `${b.site?.name} ${b.contact_person} ${b.email}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Booking Instructions" subtitle="Who to contact to book SIC at each site">
        {isAdmin && <Button variant="hero" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add instruction</Button>}
      </PageHeader>
      <Input className="mb-4 max-w-sm bg-card" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
      {rows.length === 0 ? <Panel><Empty>No booking instructions</Empty></Panel> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((b) => (
            <div key={b.id} className="overflow-hidden rounded-2xl border bg-card shadow-card">
              <div className="flex items-center justify-between bg-gradient-sun px-4 py-3">
                <p className="font-display font-bold text-warning-foreground">{b.site?.name}</p>
                {isAdmin && <div>
                  <Button size="icon" variant="ghost" onClick={() => setEditing(b)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(b.id)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>}
              </div>
              <div className="space-y-1.5 p-4 text-sm">
                <p className="font-bold">{b.contact_person}</p>
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-sky" /><a href={`mailto:${b.email}`} className="hover:underline">{b.email}</a></p>
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-teal" /><a href={`tel:${b.mobile}`}>{b.mobile}</a></p>
                {b.sic_session && <p className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-coral" />{b.sic_session}</p>}
                {b.remarks && <p className="text-muted-foreground"><b>Remarks:</b> {b.remarks}</p>}
                {b.note && <p className="text-muted-foreground"><b>Note:</b> {b.note}</p>}
                <FileLink fileId={b.attachment_id} />
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <BookingDialog b={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function BookingDialog({ b, onClose }: { b: Booking | null; onClose: () => void }) {
  const sites = useQuery(sitesQuery).data ?? [];
  const refresh = useRefresh();
  const [f, setF] = useState({
    site_id: b?.site_id ?? "", contact_person: b?.contact_person ?? "", email: b?.email ?? "",
    mobile: b?.mobile ?? "", sic_session: b?.sic_session ?? "", remarks: b?.remarks ?? "", note: b?.note ?? "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const attachment_id = file ? await uploadFile(file) : b?.attachment_id ?? null;
      await saveBooking({ data: { ...f, ...(b && { id: b.id }), attachment_id } });
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{b ? "Edit booking instruction" : "Add booking instruction"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <Field label="Site *">
            <select className={selectCls} required value={f.site_id} onChange={set("site_id")}>
              <option value="">— Choose site —</option>
              {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Contact person *"><Input required value={f.contact_person} onChange={set("contact_person")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email *"><Input type="email" required value={f.email} onChange={set("email")} /></Field>
            <Field label="Mobile *"><Input required value={f.mobile} onChange={set("mobile")} /></Field>
          </div>
          <Field label="SIC session"><Input value={f.sic_session} onChange={set("sic_session")} placeholder="e.g. Mon & Wed 8:30am" /></Field>
          <Field label="Remarks"><Textarea value={f.remarks} onChange={set("remarks")} /></Field>
          <Field label="Note"><Textarea value={f.note} onChange={set("note")} /></Field>
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

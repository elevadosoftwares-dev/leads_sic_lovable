import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { sitesQuery, sicQuery, useRefresh, uploadFile, useIsAdmin } from "@/lib/data";
import { deleteSite, saveSite, type Site } from "@/lib/sites.functions";
import { sicStatus } from "@/lib/sic";
import { PageHeader, SiteThumb, Empty, Field, Panel } from "@/components/sic-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/sites")({
  head: () => ({
    meta: [
      { title: "Sites — LEADS SIC" },
      { name: "description", content: "Client sites and their cleared technicians." },
      { property: "og:title", content: "Sites — LEADS SIC" },
      { property: "og:description", content: "Client sites and their cleared technicians." },
    ],
  }),
  component: Sites,
});

function Sites() {
  const sites = useQuery(sitesQuery).data ?? [];
  const sic = useQuery(sicQuery).data ?? [];
  const refresh = useRefresh();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Site | "new" | null>(null);
  const isAdmin = useIsAdmin();

  async function remove(id: string) {
    if (!confirm("Delete this site and all its SIC records?")) return;
    try {
      await deleteSite({ data: { id } });
    } catch (err) { toast.error((err as Error).message); return; }
    refresh();
  }

  const list = sites.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <PageHeader title="Sites" subtitle={`${sites.length} client sites`}>
        {isAdmin && <Button variant="hero" onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add site</Button>}
      </PageHeader>
      <Input className="mb-4 max-w-sm bg-card" placeholder="Search sites…" value={q} onChange={(e) => setQ(e.target.value)} />
      {list.length === 0 ? <Panel><Empty>No sites found</Empty></Panel> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const n = sic.filter((r) => r.site_id === s.id && sicStatus(r.expiry_date) !== "expired").length;
            return (
              <div key={s.id} className="overflow-hidden rounded-2xl border bg-card shadow-card">
                <Link to="/sites/$id" params={{ id: s.id }}>
                  <SiteThumb name={s.name} fileId={s.image_id} className="h-36 w-full rounded-none" />
                </Link>
                <div className="flex items-center gap-2 p-4">
                  <Link to="/sites/$id" params={{ id: s.id }} className="min-w-0 flex-1">
                    <p className="truncate font-bold hover:text-primary">{s.name}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" /> {n} cleared technicians</p>
                  </Link>
                  {isAdmin && <Button size="icon" variant="ghost" onClick={() => setEditing(s)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>}
                  {isAdmin && <Button size="icon" variant="ghost" onClick={() => remove(s.id)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && <SiteDialog site={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SiteDialog({ site, onClose }: { site: Site | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [name, setName] = useState(site?.name ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const image_id = file ? await uploadFile(file) : site?.image_id ?? null;
      await saveSite({ data: { ...(site && { id: site.id }), name: name.trim(), image_id } });
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
        <DialogHeader><DialogTitle>{site ? "Edit site" : "Add site"}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <Field label="Site name *"><Input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Site image"><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

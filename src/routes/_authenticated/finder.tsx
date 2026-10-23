import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { sitesQuery, sicQuery } from "@/lib/data";
import { sicStatus, fmtDate } from "@/lib/sic";
import { PageHeader, Panel, PersonAvatar, StatusBadge, Empty, Field, selectCls } from "@/components/sic-ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/finder")({
  head: () => ({
    meta: [
      { title: "Find Technician — LEADS SIC" },
      { name: "description", content: "Find technicians with a valid SIC by site or name." },
      { property: "og:title", content: "Find Technician — LEADS SIC" },
      { property: "og:description", content: "Find technicians with a valid SIC by site or name." },
    ],
  }),
  component: Finder,
});

function Finder() {
  const sites = useQuery(sitesQuery).data ?? [];
  const sic = useQuery(sicQuery).data ?? [];
  const [siteId, setSiteId] = useState("");
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    return sic
      .filter((r) => (!siteId || r.site_id === siteId) && r.employee?.status === "active")
      .filter((r) => (r.employee?.name ?? "").toLowerCase().includes(q.toLowerCase()))
      .map((r) => ({ ...r, st: sicStatus(r.expiry_date) }))
      .sort((a, b) => (a.st === "expired" ? 1 : 0) - (b.st === "expired" ? 1 : 0));
  }, [sic, siteId, q]);

  const cleared = results.filter((r) => r.st !== "expired");

  return (
    <div>
      <PageHeader title="Find a technician" subtitle="Search by name, optionally narrowed to a site" />
      <Panel className="mb-6 grid gap-4 md:grid-cols-2">
        <Field label="Site">
          <select className={selectCls} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">All sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Name filter">
          <Input placeholder="Search technician…" value={q} onChange={(e) => setQ(e.target.value)} />
        </Field>
      </Panel>

      <p className="mb-3 text-sm font-semibold">
        <span className="text-success">{cleared.length} valid</span>
        <span className="text-muted-foreground"> · {results.length - cleared.length} expired</span>
      </p>
      {results.length === 0 ? (
        <Panel><Empty>No matching SIC records.</Empty></Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map((r, i) => (
            <div
              key={r.id}
              className={cn(
                "flex items-center gap-4 rounded-2xl border border-t-4 bg-card p-4 shadow-card",
                ["border-t-coral", "border-t-teal", "border-t-sky", "border-t-sun"][i % 4],
                r.st === "expired" && "opacity-55",
              )}
            >
              <PersonAvatar name={r.employee?.name ?? "?"} fileId={r.employee?.image_id} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate font-bold">
                  {r.employee?.name}
                  {r.st !== "expired" && <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />}
                </p>
                <p className="truncate text-sm font-semibold text-primary">{r.site?.name}</p>
                <p className="text-xs text-muted-foreground">SIC {fmtDate(r.sic_date)} · Exp {fmtDate(r.expiry_date)}</p>
                <div className="mt-2"><StatusBadge expiry={r.expiry_date} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

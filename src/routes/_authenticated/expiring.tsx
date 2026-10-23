import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { sitesQuery, sicQuery, employeesQuery } from "@/lib/data";
import { fmtDate, sicStatus, daysUntil, downloadCsv } from "@/lib/sic";
import { PageHeader, Panel, PersonAvatar, StatusBadge, Empty, selectCls } from "@/components/sic-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/expiring")({
  head: () => ({
    meta: [
      { title: "Expiry Report — LEADS SIC" },
      { name: "description", content: "SIC records expiring in the next 30 days or already expired." },
      { property: "og:title", content: "Expiry Report — LEADS SIC" },
      { property: "og:description", content: "SIC records expiring in the next 30 days or already expired." },
    ],
  }),
  component: Expiring,
});

function Expiring() {
  const sic = useQuery(sicQuery).data ?? [];
  const sites = useQuery(sitesQuery).data ?? [];
  const emps = useQuery(employeesQuery).data ?? [];
  const [tab, setTab] = useState<"expiring" | "expired">("expiring");
  const [site, setSite] = useState("");
  const [emp, setEmp] = useState("");

  const rows = useMemo(
    () =>
      sic
        .filter((r) => sicStatus(r.expiry_date) === tab && (!site || r.site_id === site) && (!emp || r.employee_id === emp))
        .sort((a, b) => daysUntil(a.expiry_date!) - daysUntil(b.expiry_date!)),
    [sic, tab, site, emp],
  );

  return (
    <div>
      <PageHeader title="Expiry Report" subtitle="Renew inductions before technicians lose site access">
        <Button variant="outline" onClick={() => downloadCsv(`sic-${tab}.csv`, [
          ["Site", "Employee", "Date of SIC", "Expiry", "Days left"],
          ...rows.map((r) => [r.site?.name ?? "", r.employee?.name ?? "", fmtDate(r.sic_date), fmtDate(r.expiry_date), daysUntil(r.expiry_date!)]),
        ])}>
          <Download className="h-4 w-4" /> Export to Excel
        </Button>
      </PageHeader>
      <div className="mb-4 inline-flex rounded-xl bg-muted p-1">
        {(["expiring", "expired"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded-lg px-4 py-2 text-sm font-bold capitalize", tab === t ? "bg-card shadow-card" : "text-muted-foreground")}>
            {t === "expiring" ? "Next 30 days" : "Already expired"}
          </button>
        ))}
      </div>
      <Panel>
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <select className={selectCls} value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">All sites</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className={selectCls} value={emp} onChange={(e) => setEmp(e.target.value)}>
            <option value="">All technicians</option>
            {emps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {rows.length === 0 ? <Empty>No records</Empty> : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                <PersonAvatar name={r.employee?.name ?? "?"} fileId={r.employee?.image_id} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.employee?.name}</p>
                  <p className="text-xs text-muted-foreground">{r.site?.name}</p>
                </div>
                <span className="text-sm">{fmtDate(r.expiry_date)}</span>
                <StatusBadge expiry={r.expiry_date} />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

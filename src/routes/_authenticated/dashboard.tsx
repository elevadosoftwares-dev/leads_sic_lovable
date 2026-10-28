import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Building2,
  ShieldCheck,
  ClipboardList,
  AlarmClock,
  ArrowRight,
  Search,
  Users,
} from "lucide-react";
import { sitesQuery, sicQuery, bookingsQuery, employeesQuery } from "@/lib/data";
import { sicStatus, fmtDate, daysUntil } from "@/lib/sic";
import {
  PageHeader,
  Panel,
  PersonAvatar,
  StatusBadge,
  SiteThumb,
  Empty,
} from "@/components/sic-ui";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — LEADS SIC" },
      { name: "description", content: "Overview of sites, SIC records and upcoming expiries." },
      { property: "og:title", content: "Dashboard — LEADS SIC" },
      {
        property: "og:description",
        content: "Overview of sites, SIC records and upcoming expiries.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const sites = useQuery(sitesQuery).data ?? [];
  const sic = useQuery(sicQuery).data ?? [];
  const bookings = useQuery(bookingsQuery).data ?? [];
  const emps = useQuery(employeesQuery).data ?? [];

  const expiring = sic.filter((r) => sicStatus(r.expiry_date) === "expiring");
  const expired = sic.filter((r) => sicStatus(r.expiry_date) === "expired");
  const valid = sic.length - expiring.length - expired.length;

  const cards = [
    {
      label: "Total Sites",
      value: sites.length,
      icon: Building2,
      bg: "bg-gradient-teal",
      to: "/sites",
    },
    {
      label: "Registered SIC",
      value: sic.length,
      icon: ShieldCheck,
      bg: "bg-gradient-sky",
      to: "/sic",
    },
    {
      label: "Booking Instructions",
      value: bookings.length,
      icon: ClipboardList,
      bg: "bg-gradient-sun",
      to: "/bookings",
    },
    {
      label: "Expiring in 30 days",
      value: expiring.length,
      icon: AlarmClock,
      bg: "bg-gradient-coral",
      to: "/expiring",
    },
  ] as const;

  const topSites = Object.entries(
    sic.reduce<Record<string, number>>((acc, r) => {
      if (sicStatus(r.expiry_date) !== "expired" && r.site)
        acc[r.site.name] = (acc[r.site.name] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
  const max = Math.max(1, ...topSites.map((t) => t[1]));

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Safety induction status across all client sites" />
      <DashboardSearch />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            to={c.to}
            className={cn(
              "group relative overflow-hidden rounded-2xl p-5 text-primary-foreground shadow-card transition hover:-translate-y-0.5",
              c.bg,
            )}
          >
            <c.icon className="absolute -right-3 -top-3 h-24 w-24 opacity-15" />
            <p className="text-sm font-semibold opacity-90">{c.label}</p>
            <p className="mt-2 font-display text-4xl font-extrabold">{c.value}</p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold opacity-90">
              View <ArrowRight className="h-3 w-3 transition group-hover:translate-x-1" />
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">Expiring soon</h2>
            <Link to="/expiring" className="text-sm font-semibold text-primary">
              See all
            </Link>
          </div>
          {expiring.length === 0 ? (
            <Empty>Nothing expiring in the next 30 days 🎉</Empty>
          ) : (
            <ul className="divide-y">
              {expiring
                .sort((a, b) => daysUntil(a.expiry_date!) - daysUntil(b.expiry_date!))
                .slice(0, 6)
                .map((r) => (
                  <li key={r.id} className="flex items-center gap-3 py-3">
                    <PersonAvatar name={r.employee?.name ?? "?"} path={r.employee?.image_url} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.employee?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.site?.name} · expires {fmtDate(r.expiry_date)}
                      </p>
                    </div>
                    <StatusBadge expiry={r.expiry_date} />
                  </li>
                ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <h2 className="mb-4 text-lg font-bold">SIC health</h2>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="bg-success"
              style={{ width: `${(valid / Math.max(1, sic.length)) * 100}%` }}
            />
            <div
              className="bg-warning"
              style={{ width: `${(expiring.length / Math.max(1, sic.length)) * 100}%` }}
            />
            <div
              className="bg-destructive"
              style={{ width: `${(expired.length / Math.max(1, sic.length)) * 100}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat n={valid} label="Valid" cls="text-success" />
            <Stat n={expiring.length} label="Expiring" cls="text-warning-foreground" />
            <Stat n={expired.length} label="Expired" cls="text-destructive" />
          </div>
          <div className="mt-6 flex items-center gap-3 rounded-xl bg-accent p-3 text-accent-foreground">
            <Users className="h-5 w-5" />
            <span className="text-sm font-semibold">
              {emps.filter((e) => e.status === "active").length} active technicians
            </span>
          </div>
        </Panel>

        <Panel className="lg:col-span-3">
          <h2 className="mb-4 text-lg font-bold">Cleared technicians per site</h2>
          {topSites.length === 0 ? (
            <Empty>No records yet</Empty>
          ) : (
            <div className="space-y-3">
              {topSites.map(([name, n], i) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-48 truncate text-sm font-semibold md:w-72">{name}</span>
                  <div className="h-7 flex-1 rounded-lg bg-muted">
                    <div
                      className={cn(
                        "flex h-7 items-center justify-end rounded-lg pr-2 text-xs font-bold text-primary-foreground",
                        [
                          "bg-gradient-coral",
                          "bg-gradient-teal",
                          "bg-gradient-sky",
                          "bg-gradient-sun",
                        ][i % 4],
                      )}
                      style={{ width: `${Math.max(12, (n / max) * 100)}%` }}
                    >
                      {n}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ n, label, cls }: { n: number; label: string; cls: string }) {
  return (
    <div>
      <p className={cn("font-display text-2xl font-extrabold", cls)}>{n}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function DashboardSearch() {
  const sites = useQuery(sitesQuery).data ?? [];
  const emps = useQuery(employeesQuery).data ?? [];
  const sic = useQuery(sicQuery).data ?? [];
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();

  const siteHits = term ? sites.filter((s) => s.name.toLowerCase().includes(term)).slice(0, 4) : [];
  const empHits = term
    ? emps
        .filter((e) => `${e.name} ${e.designation ?? ""}`.toLowerCase().includes(term))
        .slice(0, 4)
    : [];

  return (
    <div className="mb-6">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search technicians or sites…"
          aria-label="Search technicians or sites"
          className="h-12 rounded-2xl bg-card pl-12 pr-4 text-base shadow-card"
        />
      </div>
      {term && (
        <Panel className="mt-3">
          {siteHits.length === 0 && empHits.length === 0 ? (
            <Empty>No technician or site matches this search.</Empty>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {siteHits.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Sites
                  </p>
                  <ul className="divide-y">
                    {siteHits.map((s) => (
                      <li key={s.id}>
                        <Link
                          to="/sites/$id"
                          params={{ id: s.id }}
                          className="flex items-center gap-3 py-2 transition hover:text-primary"
                        >
                          <SiteThumb name={s.name} path={s.image_url} className="h-10 w-10" />
                          <span className="truncate font-semibold">{s.name}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {empHits.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    Technicians
                  </p>
                  <ul className="divide-y">
                    {empHits.map((e) => {
                      const valid = sic.filter(
                        (r) => r.employee_id === e.id && sicStatus(r.expiry_date) !== "expired",
                      ).length;
                      return (
                        <li key={e.id}>
                          <Link
                            to="/technicians"
                            search={{ q: e.name }}
                            className="flex items-center gap-3 py-2 transition hover:text-primary"
                          >
                            <PersonAvatar name={e.name} path={e.image_url} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-semibold">{e.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {valid} valid SIC · {e.designation || "Technician"}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

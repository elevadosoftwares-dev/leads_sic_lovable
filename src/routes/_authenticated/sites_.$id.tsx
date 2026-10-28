import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { sitesQuery, sicQuery, bookingsQuery } from "@/lib/data";
import { fmtDate } from "@/lib/sic";
import {
  PageHeader,
  Panel,
  PersonAvatar,
  StatusBadge,
  Empty,
  SiteThumb,
} from "@/components/sic-ui";

export const Route = createFileRoute("/_authenticated/sites_/$id")({
  head: () => ({
    meta: [
      { title: "Site details — LEADS SIC" },
      { name: "description", content: "SIC holders and booking instructions for a client site." },
      { property: "og:title", content: "Site details — LEADS SIC" },
      {
        property: "og:description",
        content: "SIC holders and booking instructions for a client site.",
      },
    ],
  }),
  component: SiteView,
});

function SiteView() {
  const { id } = Route.useParams();
  const site = (useQuery(sitesQuery).data ?? []).find((s) => s.id === id);
  const sic = (useQuery(sicQuery).data ?? []).filter((r) => r.site_id === id);
  const bookings = (useQuery(bookingsQuery).data ?? []).filter((b) => b.site_id === id);

  return (
    <div>
      <Link
        to="/sites"
        className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All sites
      </Link>
      <div className="mb-2 flex items-center gap-4">
        {site && <SiteThumb name={site.name} path={site.image_url} />}
        <PageHeader title={site?.name ?? "Site"} subtitle={`${sic.length} SIC holders`} />
      </div>
      {bookings.length > 0 && (
        <Panel className="mb-6 bg-accent">
          <h2 className="mb-2 font-bold">How to book SIC here</h2>
          {bookings.map((b) => (
            <div key={b.id} className="text-sm">
              <p>
                <b>{b.contact_person}</b> · {b.email} · {b.mobile}
              </p>
              {b.sic_session && <p>Session: {b.sic_session}</p>}
              {b.note && <p className="text-muted-foreground">{b.note}</p>}
            </div>
          ))}
        </Panel>
      )}
      {sic.length === 0 ? (
        <Panel>
          <Empty>No SIC holders for this site yet.</Empty>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sic.map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-3 rounded-2xl border bg-card p-4 shadow-card"
            >
              <PersonAvatar name={r.employee?.name ?? "?"} path={r.employee?.image_url} size="lg" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-bold">{r.employee?.name}</p>
                <p className="text-muted-foreground">SIC: {fmtDate(r.sic_date)}</p>
                <p className="text-muted-foreground">Expiry: {fmtDate(r.expiry_date)}</p>
                <p className="text-muted-foreground">Pass issued: {r.pass_issued ? "Yes" : "No"}</p>
                <div className="mt-2">
                  <StatusBadge expiry={r.expiry_date} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

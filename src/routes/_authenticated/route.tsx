import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  ShieldCheck,
  Users,
  Building2,
  ClipboardList,
  AlarmClock,
  Search,
  LogOut,
  Menu,
  X,
  UserCog,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { signOut } from "@/lib/auth.functions";
import { sessionQuery, useIsAdmin } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.fetchQuery(sessionQuery);
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: Layout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, chip: "bg-gradient-coral" },
  { to: "/finder", label: "Find Technician", icon: Search, chip: "bg-gradient-sun" },
  { to: "/sic", label: "SIC Records", icon: ShieldCheck, chip: "bg-gradient-teal" },
  { to: "/expiring", label: "Expiry Report", icon: AlarmClock, chip: "bg-gradient-coral" },
  { to: "/technicians", label: "Technicians", icon: Users, chip: "bg-gradient-sky" },
  { to: "/sites", label: "Sites", icon: Building2, chip: "bg-gradient-teal" },
  { to: "/bookings", label: "Booking Instructions", icon: ClipboardList, chip: "bg-gradient-sun" },
] as const;

function Layout() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const isAdmin = useIsAdmin();
  const items = isAdmin
    ? [...nav, { to: "/users", label: "Users", icon: UserCog, chip: "bg-gradient-sky" }]
    : nav;

  return (
    <div className="min-h-screen md:flex">
      <header className="flex items-center justify-between bg-nav px-4 py-3 text-nav-foreground md:hidden">
        <Brand />
        <button onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X /> : <Menu />}
        </button>
      </header>
      <aside
        className={cn(
          "bg-gradient-nav text-nav-foreground md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:p-5",
          open ? "block p-4" : "hidden",
        )}
      >
        <div className="mb-8 hidden md:block">
          <Brand />
        </div>
        <nav className="space-y-1">
          {items.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-nav-muted transition hover:bg-nav-active hover:text-nav-foreground"
              activeProps={{ className: "bg-nav-active !text-nav-foreground" }}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-primary-foreground shadow transition group-hover:scale-110",
                  n.chip,
                )}
              >
                <n.icon className="h-4 w-4" />
              </span>
              <span className="flex-1">{n.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-sidebar-border pt-4">
          <p className="truncate px-3 text-xs text-nav-muted">{user.email}</p>
          <button
            onClick={async () => {
              await signOut();
              qc.clear();
              navigate({ to: "/auth" });
            }}
            className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-nav-muted hover:bg-nav-active hover:text-nav-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 font-display text-lg font-bold">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
        <ShieldCheck className="h-5 w-5" />
      </span>
      LEADS SIC
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Eye, UserPlus, Trash2, KeyRound, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";
import { sessionQuery, userRolesQuery, useIsAdmin, useRefresh } from "@/lib/data";
import { createUser, deleteUser, resetUserPassword, setUserRole } from "@/lib/users.functions";
import { PageHeader, Panel, Empty, Field, selectCls } from "@/components/sic-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users — LEADS SIC" },
      { name: "description", content: "Add users and manage who can edit or only view." },
      { property: "og:title", content: "Users — LEADS SIC" },
      { property: "og:description", content: "Add users and manage who can edit or only view." },
    ],
  }),
  component: Users,
});

type Role = "admin" | "viewer";

function Users() {
  const roles = useQuery(userRolesQuery).data ?? [];
  const isAdmin = useIsAdmin();
  const refresh = useRefresh();
  const del = useServerFn(deleteUser);
  const me = useQuery(sessionQuery).data?.userId ?? null;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | Role>("all");
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<{ id: string; email: string } | null>(null);

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Users" />
        <Panel>
          <Empty>Only admins can manage users.</Empty>
        </Panel>
      </div>
    );
  }

  async function setRole(userId: string, role: Role) {
    try {
      await setUserRole({ data: { userId, role } });
    } catch (err) {
      toast.error((err as Error).message);
      return;
    }
    toast.success("Access updated");
    refresh();
  }

  async function remove(userId: string, email: string) {
    if (!confirm(`Remove ${email}? They will no longer be able to sign in.`)) return;
    try {
      await del({ data: { userId } });
      toast.success("User removed");
      refresh();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const admins = roles.filter((r) => r.role === "admin").length;
  const list = roles.filter(
    (r) =>
      (filter === "all" || r.role === filter) &&
      (r.email ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <PageHeader title="Users" subtitle="Add people and choose what they can do">
        <Button variant="hero" onClick={() => setAdding(true)}>
          <UserPlus className="h-4 w-4" /> Add user
        </Button>
      </PageHeader>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {(
          [
            ["all", "All users", roles.length, UsersIcon],
            ["admin", "Admins", admins, ShieldCheck],
            ["viewer", "Read only", roles.length - admins, Eye],
          ] as const
        ).map(([key, label, n, Icon]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-card transition",
              filter === key && "ring-2 ring-primary",
            )}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold leading-none">{n}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </button>
        ))}
      </div>

      <Input
        className="mb-4 max-w-sm bg-card"
        placeholder="Search by email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <Panel>
        {list.length === 0 ? (
          <Empty>No users found</Empty>
        ) : (
          <div className="divide-y">
            {list.map((r) => {
              const self = r.user_id === me;
              const email = r.email ?? "Unknown";
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold uppercase",
                      r.role === "admin"
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {email.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {email}{" "}
                      {self && (
                        <span className="ml-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-accent-foreground">
                          You
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.role === "admin"
                        ? "Admin — can add, edit and delete"
                        : "Read only — can view everything"}
                    </p>
                  </div>
                  <select
                    className={cn(selectCls, "w-36")}
                    value={r.role}
                    disabled={self}
                    onChange={(e) => setRole(r.user_id, e.target.value as Role)}
                  >
                    <option value="admin">Admin</option>
                    <option value="viewer">Read only</option>
                  </select>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Reset password"
                    title="Reset password"
                    onClick={() => setResetting({ id: r.user_id, email })}
                  >
                    <KeyRound className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove user"
                    title="Remove user"
                    disabled={self}
                    onClick={() => remove(r.user_id, email)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {adding && <AddUserDialog onClose={() => setAdding(false)} />}
      {resetting && <ResetDialog user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function AddUserDialog({ onClose }: { onClose: () => void }) {
  const create = useServerFn(createUser);
  const refresh = useRefresh();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { email, password, role } });
      toast.success(`${email} can sign in now`);
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
          <DialogTitle>Add user</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email *">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password * (min 6 characters)">
            <Input
              type="text"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["viewer", "Read only", "Can view everything", Eye],
                ["admin", "Admin", "Can add, edit, delete", ShieldCheck],
              ] as const
            ).map(([v, label, desc, Icon]) => (
              <button
                type="button"
                key={v}
                onClick={() => setRole(v)}
                className={cn(
                  "rounded-xl border p-3 text-left transition",
                  role === v ? "border-primary bg-primary/5 ring-2 ring-primary" : "bg-card",
                )}
              >
                <Icon className="mb-1 h-5 w-5 text-primary" />
                <p className="text-sm font-bold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Share the password with the person yourself — no email is sent.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" disabled={busy}>
              {busy ? "Creating…" : "Create user"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({
  user,
  onClose,
}: {
  user: { id: string; email: string };
  onClose: () => void;
}) {
  const reset = useServerFn(resetUserPassword);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await reset({ data: { userId: user.id, password } });
      toast.success("Password changed");
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
          <DialogTitle>Reset password</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            New password for <b>{user.email}</b>
          </p>
          <Input
            type="text"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min 6 characters"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="hero" disabled={busy}>
              {busy ? "Saving…" : "Save password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { sicStatus, daysUntil } from "@/lib/sic";
import { cn } from "@/lib/utils";

/** Address of an uploaded file (served to signed-in users by src/routes/api/files/$.ts). */
export function useSignedUrl(path: string | null | undefined) {
  return path ? `/api/files/${path.split("/").map(encodeURIComponent).join("/")}` : null;
}

const avatarColors = [
  "bg-gradient-coral",
  "bg-gradient-teal",
  "bg-gradient-sky",
  "bg-gradient-sun",
];

export function PersonAvatar({
  name,
  path,
  size = "md",
}: {
  name: string;
  path?: string | null;
  size?: "md" | "lg";
}) {
  const url = useSignedUrl(path);
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const color = avatarColors[name.length % avatarColors.length];
  const dim = size === "lg" ? "h-[7.2rem] w-[7.2rem] text-3xl" : "h-15 w-15 text-base";
  if (url) return <img src={url} alt={name} className={cn("rounded-full object-cover", dim)} />;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-bold text-primary-foreground",
        color,
        dim,
      )}
    >
      {initials}
    </div>
  );
}

export function SiteThumb({
  name,
  path,
  className,
}: {
  name: string;
  path?: string | null;
  className?: string;
}) {
  const url = useSignedUrl(path);
  const dim = className ?? "h-[4.125rem] w-24";
  if (url) return <img src={url} alt={name} className={cn("rounded-lg object-cover", dim)} />;
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-gradient-teal font-display text-xl font-bold text-primary-foreground",
        dim,
      )}
    >
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export function FileLink({ path }: { path?: string | null }) {
  const url = useSignedUrl(path);
  if (!path) return null;
  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-semibold text-sky hover:underline"
    >
      <FileText className="h-3.5 w-3.5" /> Attachment
    </a>
  );
}

export function StatusBadge({ expiry }: { expiry: string | null }) {
  const s = sicStatus(expiry);
  const map = {
    valid: "bg-success/15 text-success",
    expiring: "bg-warning/20 text-warning-foreground",
    expired: "bg-destructive/15 text-destructive",
  };
  const label =
    s === "expired"
      ? "Expired"
      : s === "expiring"
        ? `${daysUntil(expiry!)}d left`
        : expiry
          ? "Valid"
          : "No expiry";
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-bold", map[s])}>
      {label}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
          <span className="text-gradient">{title}</span>
        </h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-2 flex gap-1" aria-hidden>
          <span className="h-1.5 w-9 rounded-full bg-gradient-coral" />
          <span className="h-1.5 w-5 rounded-full bg-gradient-teal" />
          <span className="h-1.5 w-2.5 rounded-full bg-gradient-sun" />
          <span className="h-1.5 w-1.5 rounded-full bg-gradient-sky" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-card md:p-6", className)}>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-12 text-center text-sm text-muted-foreground">{children}</div>;
}

export const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring";

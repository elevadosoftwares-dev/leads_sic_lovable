export type SicStatus = "valid" | "expiring" | "expired";

/** Days before expiry when a SIC counts as "expiring soon". */
export const EXPIRING_WINDOW_DAYS = 30;

function toDay(d: string | Date) {
  const x = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function daysUntil(expiry: string, today: Date = new Date()) {
  return Math.round((toDay(expiry).getTime() - toDay(today).getTime()) / 86400000);
}

/** No expiry date recorded = treated as valid. Expiry day itself is still valid. */
export function sicStatus(expiry: string | null | undefined, today: Date = new Date()): SicStatus {
  if (!expiry) return "valid";
  const d = daysUntil(expiry, today);
  if (d < 0) return "expired";
  if (d <= EXPIRING_WINDOW_DAYS) return "expiring";
  return "valid";
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const [y, m, day] = d.slice(0, 10).split("-");
  return `${day}-${m}-${y}`;
}

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

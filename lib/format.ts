import type { Agency, Status } from "./types";

export const STATUS_COLOR: Record<Status, string> = {
  New: "var(--st-new)",
  Researching: "var(--st-research)",
  Working: "var(--st-working)",
  "Passed to M&A": "var(--st-passed)",
  Lost: "var(--st-lost)",
};

export const STATUS_KEY: Record<Status, string> = {
  New: "new",
  Researching: "research",
  Working: "working",
  "Passed to M&A": "passed",
  Lost: "lost",
};

export function money(lo: number | null, hi: number | null, unit = "M"): string {
  if (lo == null && hi == null) return "—";
  const f = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1));
  if (lo == null || hi == null || Math.abs(lo - hi) < 0.05) return `$${f((lo ?? hi)!)}${unit}`;
  return `$${f(lo)}–${f(hi)}${unit}`;
}

export const midpoint = (a: Agency) =>
  a.revenueLow != null && a.revenueHigh != null ? (a.revenueLow + a.revenueHigh) / 2 : a.revenueLow ?? a.revenueHigh ?? null;

export function relTime(iso: string | null | undefined): string {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 14) return `${Math.floor(s / 86400)}d ago`;
  return shortDate(iso);
}

export function shortDate(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T12:00:00") : new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

export const pad2 = (n: number | null) => (n == null ? "—" : String(n).padStart(2, "0"));

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export const linkedinSearch = (name: string) =>
  `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(name)}`;

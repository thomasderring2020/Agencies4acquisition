export const STATUSES = ["New", "Researching", "Working", "Passed to M&A", "Lost"] as const;
export type Status = (typeof STATUSES)[number];

export type GeoPrecision = "coords" | "address" | "city" | "state" | "none";

/** One agency row from the Google Sheet, normalized. Sheet data is replaced on every sync. */
export interface Agency {
  id: string;
  rank: number | null;
  priority: string;
  name: string;
  hq: string;
  city: string;
  state: string;
  address: string;
  lat: number | null;
  lng: number | null;
  geo: GeoPrecision;
  revenueLow: number | null;
  revenueHigh: number | null;
  revenueBasis: string;
  revenueStatus: string;
  ebitdaLow: number | null;
  ebitdaHigh: number | null;
  ebitdaBasis: string;
  evLow: number | null;
  evHigh: number | null;
  specialty: string;
  growth: string;
  ownership: string;
  feasibility: string;
  fit: string;
  risk: string;
  nextStep: string;
  primarySource: string;
  secondarySource: string;
  sheetStatus: string;
  weekAdded: string;
  website: string;
  linkedin: string;
  tier: string;
  targetMarket: string;
  decisionMakers: string;
  outreachPath: string;
  confidence: string;
  /** Any sheet columns the app doesn't know about yet, shown under "Other fields". */
  extra: Record<string, string>;
  /** False when the agency was in an earlier sync but is no longer in the sheet. */
  inSheet: boolean;
}

export interface SyncMeta {
  syncedAt: string | null;
  source: "sheet" | "upload" | "cron" | null;
  sheetNote: string;
  screenNote: string;
  excludedStates: string[];
  total: number;
  added: number;
  removed: number;
  unmapped: string[];
}

/** Team-owned data. Never touched by a sheet sync. */
export interface StatusRecord {
  status: Status;
  by: string;
  at: string;
}

export interface Overrides {
  linkedin?: string;
  website?: string;
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  phone: string;
  email: string;
  linkedin: string;
  addedBy: string;
  addedAt: string;
}

export interface Note {
  id: string;
  text: string;
  by: string;
  at: string;
}

export interface AgencyListPayload {
  agencies: Agency[];
  statuses: Record<string, StatusRecord>;
  overrides: Record<string, Overrides>;
  counts: Record<string, { contacts: number; notes: number }>;
  meta: SyncMeta;
  storage: "redis" | "local";
  sheetConfigured: boolean;
}

/**
 * The sheet's own "Status" column is the researcher's call (New / Watch / Pass), not the team's
 * pipeline stage. It only seeds a team status when it is exactly one of the five team statuses.
 */
export function statusFromSheet(raw: string): Status | null {
  const v = raw.trim().toLowerCase();
  return STATUSES.find((s) => s.toLowerCase() === v) ?? null;
}

export function effectiveStatus(a: Agency, statuses: Record<string, StatusRecord>): Status {
  return statuses[a.id]?.status ?? statusFromSheet(a.sheetStatus) ?? "New";
}

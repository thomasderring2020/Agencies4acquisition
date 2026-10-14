import Papa from "papaparse";
import type { Agency } from "./types";
import { ABBRS, statesNamedIn } from "./states";

/**
 * Maps sheet headers to Agency fields. Matching is forgiving (case, punctuation and
 * suffixes like "@35% ($M)" are ignored), so small header edits in the sheet don't break sync.
 */
const FIELD_MATCHERS: [keyof Agency, RegExp][] = [
  ["rank", /^rank$/],
  ["priority", /^diligence priority|^priority$/],
  ["name", /^agency( name)?$|^name$/],
  ["hq", /^hq|^headquarters|^location$/],
  ["address", /^(street )?address/],
  ["city", /^city$/],
  ["state", /^state$/],
  ["revenueLow", /^revenue low/],
  ["revenueHigh", /^revenue high/],
  ["revenueBasis", /^revenue basis/],
  ["revenueStatus", /^revenue status/],
  ["ebitdaLow", /ebitda low/],
  ["ebitdaHigh", /ebitda high/],
  ["ebitdaBasis", /^ebitda basis/],
  ["evLow", /\bev low/],
  ["evHigh", /\bev high/],
  ["specialty", /^business|specialty/],
  ["growth", /^growth/],
  ["ownership", /^ownership/],
  ["feasibility", /^feasibility/],
  ["fit", /relation fit|^fit$/],
  ["risk", /^key risk|^risk/],
  ["nextStep", /next (diligence )?step/],
  ["primarySource", /^primary source/],
  ["secondarySource", /^secondary source/],
  ["sheetStatus", /^status$/],
  ["weekAdded", /^week added|^date added|^added/],
  ["website", /^website|^url$/],
  ["linkedin", /linkedin/],
  ["tier", /priority tier|^tier$/],
  ["targetMarket", /^target market|^market$/],
  ["decisionMakers", /decision.?makers/],
  ["outreachPath", /introduction|outreach/],
  ["confidence", /confidence/],
];

const NUMERIC = new Set<keyof Agency>(["rank", "revenueLow", "revenueHigh", "ebitdaLow", "ebitdaHigh", "evLow", "evHigh"]);

const normHeader = (h: string) => h.toLowerCase().replace(/\s+/g, " ").trim();

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function num(v: string): number | null {
  const cleaned = v.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "Dallas / Fort Worth, TX" → {city: "Dallas", alts: ["Fort Worth"], state: "TX"} */
export function parseHQ(hq: string): { city: string; alts: string[]; state: string } {
  const m = /,\s*([A-Z]{2})\b/.exec(hq);
  if (!m || !ABBRS.has(m[1])) {
    const named = statesNamedIn(hq);
    return { city: "", alts: [], state: named[0] ?? "" };
  }
  const before = hq.slice(0, m.index);
  const clause = before.split(";").pop() ?? before;
  const parts = clause
    .split(/\s*\/\s*|\s+and\s+|\s*&\s*/)
    .map((p) => p.replace(/\(.*?\)/g, "").trim())
    .filter(Boolean);
  return { city: parts[0] ?? "", alts: parts.slice(1), state: m[1] };
}

export interface ParsedSheet {
  agencies: (Agency & { cityAlts: string[]; latRaw?: number | null; lngRaw?: number | null })[];
  sheetNote: string;
  screenNote: string;
  excludedStates: string[];
  headers: string[];
}

export function parseSheetCsv(csv: string): ParsedSheet {
  const { data } = Papa.parse<string[]>(csv.replace(/^﻿/, ""), { skipEmptyLines: false });
  const rows = data as string[][];

  // The sheet has a few note rows above the real header. Find the header row by its columns.
  const headerIdx = rows.findIndex((r) => {
    const cells = r.map(normHeader);
    return cells.some((c) => /^agency( name)?$|^name$/.test(c)) && cells.filter(Boolean).length >= 3;
  });
  if (headerIdx < 0) throw new Error('Could not find a header row with an "Agency" column.');

  const preamble = rows
    .slice(0, headerIdx)
    .map((r) => r.filter(Boolean).join(" ").trim())
    .filter(Boolean);
  const sheetNote = preamble.find((p) => /updated/i.test(p)) ?? "";
  const screenNote = preamble.find((p) => /screen|exclusion/i.test(p)) ?? "";
  const exclMatch = /exclusions?:\s*([^.]+)/i.exec(screenNote);
  const excludedStates = exclMatch ? statesNamedIn(exclMatch[1]) : [];

  const headers = rows[headerIdx].map((h) => h.trim());
  const colMap: (keyof Agency | null)[] = headers.map((h) => {
    const n = normHeader(h);
    if (!n) return null;
    for (const [field, re] of FIELD_MATCHERS) if (re.test(n)) return field;
    return null;
  });
  // If a column claims a field twice (e.g. two "risk" columns), keep the first.
  const seen = new Set<string>();
  colMap.forEach((f, i) => {
    if (!f) return;
    if (seen.has(f)) colMap[i] = null;
    else seen.add(f);
  });
  const latIdx = headers.findIndex((h) => /^lat(itude)?$/i.test(h.trim()));
  const lngIdx = headers.findIndex((h) => /^(lng|lon|long|longitude)$/i.test(h.trim()));

  const out: ParsedSheet["agencies"] = [];
  const ids = new Set<string>();
  for (const r of rows.slice(headerIdx + 1)) {
    const a: Record<string, unknown> = { extra: {} as Record<string, string> };
    headers.forEach((h, i) => {
      const v = (r[i] ?? "").trim();
      const f = colMap[i];
      if (f) a[f] = NUMERIC.has(f) ? num(v) : v;
      else if (h && v && i !== latIdx && i !== lngIdx) (a.extra as Record<string, string>)[h] = v;
    });
    const name = String(a.name ?? "").trim();
    if (!name) continue;
    let id = slugify(name);
    if (ids.has(id)) id = `${id}-${ids.size}`;
    ids.add(id);

    const hq = String(a.hq ?? "");
    const parsed = parseHQ(hq);
    const agency = {
      id,
      rank: null, priority: "", name, hq: "", city: "", state: "", address: "",
      lat: null, lng: null, geo: "none",
      revenueLow: null, revenueHigh: null, revenueBasis: "", revenueStatus: "",
      ebitdaLow: null, ebitdaHigh: null, ebitdaBasis: "", evLow: null, evHigh: null,
      specialty: "", growth: "", ownership: "", feasibility: "", fit: "", risk: "", nextStep: "",
      primarySource: "", secondarySource: "", sheetStatus: "", weekAdded: "", website: "", linkedin: "",
      tier: "", targetMarket: "", decisionMakers: "", outreachPath: "", confidence: "",
      inSheet: true,
      ...a,
      cityAlts: parsed.alts,
      latRaw: latIdx >= 0 ? num(r[latIdx] ?? "") : null,
      lngRaw: lngIdx >= 0 ? num(r[lngIdx] ?? "") : null,
    } as ParsedSheet["agencies"][number];
    if (!agency.city) agency.city = parsed.city;
    if (!agency.state) agency.state = parsed.state;
    agency.state = agency.state.toUpperCase().slice(0, 2);
    if (agency.website && !/^https?:\/\//i.test(agency.website)) agency.website = `https://${agency.website}`;
    out.push(agency);
  }
  return { agencies: out, sheetNote, screenNote, excludedStates, headers };
}

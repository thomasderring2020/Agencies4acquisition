import { parseSheetCsv } from "./parse";
import { geocode } from "./geocode";
import { store } from "./store";
import type { Agency, SyncMeta } from "./types";

/** Accepts a "Publish to web" CSV link or a normal share/edit link and returns a CSV download URL. */
export function toCsvUrl(raw: string): string {
  const url = raw.trim();
  if (/output=csv|format=csv|\/pub\?|\/gviz\//.test(url)) return url;
  const m = /docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(url);
  if (m && m[1] !== "e") {
    const gid = /[#&?]gid=(\d+)/.exec(url)?.[1] ?? "0";
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
  }
  return url;
}

export async function fetchSheetCsv(): Promise<string> {
  const raw = process.env.SHEET_CSV_URL;
  if (!raw) throw new Error("SHEET_CSV_URL is not set. Add it in Vercel → Settings → Environment Variables.");
  const res = await fetch(toCsvUrl(raw), { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Google Sheets returned ${res.status}. Check the sheet is published or shared by link.`);
  const text = await res.text();
  if (/^\s*<!doctype html|<html/i.test(text.slice(0, 200)))
    throw new Error("Got a web page instead of CSV. The sheet must be published to the web (or shared: anyone with the link).");
  return text;
}

export async function runSync(csv: string, source: SyncMeta["source"]): Promise<SyncMeta> {
  const parsed = parseSheetCsv(csv);
  if (!parsed.agencies.length) throw new Error("The sheet had a header row but no agencies under it.");

  const existing = await store.agencies();
  const next: Record<string, Agency> = {};
  const unmapped: string[] = [];
  let added = 0;

  // Geocode in small parallel batches; city lookups are instant, addresses hit the Census API.
  const queue = [...parsed.agencies];
  while (queue.length) {
    const batch = queue.splice(0, 8);
    await Promise.all(
      batch.map(async (row) => {
        const { cityAlts, latRaw, lngRaw, ...agency } = row;
        const prev = existing[agency.id];
        const sameLocation =
          prev && prev.lat != null && prev.hq === agency.hq && prev.address === agency.address && latRaw == null;
        const g = sameLocation
          ? { lat: prev.lat, lng: prev.lng, geo: prev.geo }
          : await geocode({ address: agency.address, city: agency.city, cityAlts, state: agency.state, latRaw, lngRaw }, store.geoCache);
        if (g.geo === "none" || g.geo === "state") unmapped.push(`${agency.name} (${agency.hq || "no HQ"})`);
        if (!prev) added++;
        next[agency.id] = { ...agency, ...g, inSheet: true };
      })
    );
  }

  // Keep agencies that dropped off the sheet so their contacts and notes stay visible.
  let removed = 0;
  for (const [id, prev] of Object.entries(existing)) {
    if (!next[id]) {
      next[id] = { ...prev, inSheet: false };
      if (prev.inSheet) removed++;
    }
  }

  await store.replaceAgencies(next);
  const meta: SyncMeta = {
    syncedAt: new Date().toISOString(),
    source,
    sheetNote: parsed.sheetNote,
    screenNote: parsed.screenNote,
    excludedStates: parsed.excludedStates,
    total: parsed.agencies.length,
    added,
    removed,
    unmapped,
  };
  await store.setMeta(meta);
  return meta;
}

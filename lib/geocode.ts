import cities from "@/data/us-cities.json";
import centroids from "@/data/state-centroids.json";
import type { GeoPrecision } from "./types";

const CITY = cities as unknown as Record<string, [number, number]>;
const STATE = centroids as unknown as Record<string, [number, number]>;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

function cityVariants(city: string): string[] {
  const c = norm(city);
  const v = [c];
  if (c.startsWith("st ")) v.push("saint " + c.slice(3));
  if (c.startsWith("saint ")) v.push("st " + c.slice(6));
  if (c.startsWith("ft ")) v.push("fort " + c.slice(3));
  if (c.startsWith("mt ")) v.push("mount " + c.slice(3));
  return v;
}

export function lookupCity(city: string, state: string): [number, number] | null {
  if (!city || !state) return null;
  for (const v of cityVariants(city)) {
    const hit = CITY[`${v}|${state}`];
    if (hit) return hit;
  }
  return null;
}

/** US Census geocoder: free, no key, street addresses only. Runs on the server during sync. */
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?benchmark=Public_AR_Current&format=json&address=" +
    encodeURIComponent(address);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const json = await res.json();
    const m = json?.result?.addressMatches?.[0]?.coordinates;
    if (m && typeof m.x === "number" && typeof m.y === "number") return [m.y, m.x];
  } catch {
    /* fall through to city */
  }
  return null;
}

export interface GeoInput {
  address: string;
  city: string;
  cityAlts: string[];
  state: string;
  latRaw?: number | null;
  lngRaw?: number | null;
}

export async function geocode(
  a: GeoInput,
  cache: { get(k: string): Promise<[number, number] | null>; set(k: string, v: [number, number]): Promise<void> }
): Promise<{ lat: number | null; lng: number | null; geo: GeoPrecision }> {
  if (a.latRaw != null && a.lngRaw != null) return { lat: a.latRaw, lng: a.lngRaw, geo: "coords" };

  if (a.address) {
    const full = [a.address, a.city, a.state].filter(Boolean).join(", ");
    const key = "addr:" + norm(full);
    const cached = await cache.get(key);
    if (cached) return { lat: cached[0], lng: cached[1], geo: "address" };
    const hit = await geocodeAddress(full);
    if (hit) {
      await cache.set(key, hit);
      return { lat: hit[0], lng: hit[1], geo: "address" };
    }
  }

  for (const c of [a.city, ...a.cityAlts]) {
    const hit = lookupCity(c, a.state);
    if (hit) return { lat: hit[0], lng: hit[1], geo: "city" };
  }

  const st = STATE[a.state];
  if (st) return { lat: st[0], lng: st[1], geo: "state" };
  return { lat: null, lng: null, geo: "none" };
}

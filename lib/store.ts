import { Redis } from "@upstash/redis";
import fs from "fs";
import path from "path";
import type { Agency, Contact, Note, Overrides, StatusRecord, SyncMeta } from "./types";

/**
 * Storage layer. Uses Upstash Redis when its env vars are present (production on Vercel),
 * otherwise a local JSON file so the app runs on a laptop with zero setup.
 *
 * Every piece of team data (status, contacts, notes, links) lives under its own key or hash
 * field, so two people saving at the same moment never overwrite each other.
 */

type Hash = Record<string, string>;

interface Backend {
  kind: "redis" | "local";
  hgetall(key: string): Promise<Hash>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, values: Hash): Promise<void>;
  hdel(key: string, field: string): Promise<void>;
  hlen(key: string): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  replaceHash(key: string, values: Hash): Promise<void>;
}

const P = "mna:";
const K = {
  agencies: P + "agencies",
  meta: P + "meta",
  status: P + "status",
  overrides: P + "overrides",
  geo: P + "geo",
  counts: P + "counts",
  contacts: (id: string) => `${P}contacts:${id}`,
  notes: (id: string) => `${P}notes:${id}`,
};

/** Trim whitespace and stray quotes people often paste into env var values. */
const clean = (v: string | undefined) => (v ?? "").trim().replace(/^['"]+|['"]+$/g, "").trim();

/**
 * Find Upstash REST credentials. Accepts the Upstash names, the Vercel Marketplace names
 * (KV_REST_API_*), the same names with any custom prefix Vercel may add (e.g. STORAGE_KV_REST_API_URL),
 * and as a last resort derives them from an Upstash redis:// connection string.
 */
export function findRedisConfig(): { url: string; token: string; from: string } | null {
  const env = process.env;
  const keys = Object.keys(env);
  const pairs: [RegExp, RegExp][] = [
    [/(^|_)UPSTASH_REDIS_REST_URL$/, /(^|_)UPSTASH_REDIS_REST_TOKEN$/],
    [/(^|_)KV_REST_API_URL$/, /(^|_)KV_REST_API_TOKEN$/],
    [/(^|_)REDIS_REST_URL$/, /(^|_)REDIS_REST_TOKEN$/],
  ];
  for (const [u, t] of pairs) {
    const uk = keys.find((k) => u.test(k) && clean(env[k]));
    const tk = keys.find((k) => t.test(k) && !/READ_ONLY/.test(k) && clean(env[k]));
    if (uk && tk) {
      let url = clean(env[uk]);
      if (!/^https?:\/\//.test(url)) url = `https://${url.replace(/^rediss?:\/\//, "").replace(/:\d+$/, "")}`;
      return { url: url.replace(/\/+$/, ""), token: clean(env[tk]), from: `${uk} + ${tk}` };
    }
  }
  // Fallback: rediss://default:<token>@<host>.upstash.io:6379 → REST URL + token
  const ck = keys.find((k) => /(^|_)(KV_URL|REDIS_URL)$/.test(k) && /upstash\.io/.test(clean(env[k])));
  if (ck) {
    try {
      const u = new URL(clean(env[ck]));
      if (u.password) return { url: `https://${u.hostname}`, token: decodeURIComponent(u.password), from: ck };
    } catch {
      /* not a URL */
    }
  }
  return null;
}

/** Upstash returns HGETALL as a flat [field, value, field, value] list when auto-deserialization is off. */
function toHash(raw: unknown): Hash {
  if (!raw) return {};
  if (Array.isArray(raw)) {
    const out: Hash = {};
    for (let i = 0; i + 1 < raw.length; i += 2) out[String(raw[i])] = String(raw[i + 1]);
    return out;
  }
  if (typeof raw === "object") {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])
    );
  }
  return {};
}

function redisBackend(): Backend | null {
  const cfg = findRedisConfig();
  if (!cfg) return null;
  const { url, token } = cfg;
  const r = new Redis({ url, token, automaticDeserialization: false });
  return {
    kind: "redis",
    async hgetall(key) {
      return toHash(await r.hgetall(key));
    },
    async hget(key, field) {
      return ((await r.hget(key, field)) as string | null) ?? null;
    },
    async hset(key, values) {
      if (Object.keys(values).length) await r.hset(key, values);
    },
    async hdel(key, field) {
      await r.hdel(key, field);
    },
    async hlen(key) {
      return Number(await r.hlen(key)) || 0;
    },
    async get(key) {
      return ((await r.get(key)) as string | null) ?? null;
    },
    async set(key, value) {
      await r.set(key, value);
    },
    async replaceHash(key, values) {
      const tx = r.multi();
      tx.del(key);
      if (Object.keys(values).length) tx.hset(key, values);
      await tx.exec();
    },
  };
}

function localBackend(): Backend {
  const file =
    process.env.LOCAL_DB_PATH || (process.env.VERCEL ? "/tmp/mna-db.json" : path.join(process.cwd(), ".data", "db.json"));
  type DB = { hashes: Record<string, Hash>; strings: Record<string, string> };
  const load = (): DB => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return { hashes: {}, strings: {} };
    }
  };
  const save = (db: DB) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db));
  };
  const mutate = async (fn: (db: DB) => void) => {
    const db = load();
    fn(db);
    save(db);
  };
  return {
    kind: "local",
    async hgetall(key) {
      return load().hashes[key] ?? {};
    },
    async hget(key, field) {
      return load().hashes[key]?.[field] ?? null;
    },
    async hset(key, values) {
      await mutate((db) => (db.hashes[key] = { ...(db.hashes[key] ?? {}), ...values }));
    },
    async hdel(key, field) {
      await mutate((db) => {
        if (db.hashes[key]) delete db.hashes[key][field];
      });
    },
    async hlen(key) {
      return Object.keys(load().hashes[key] ?? {}).length;
    },
    async get(key) {
      return load().strings[key] ?? null;
    },
    async set(key, value) {
      await mutate((db) => (db.strings[key] = value));
    },
    async replaceHash(key, values) {
      await mutate((db) => (db.hashes[key] = { ...values }));
    },
  };
}

let backend: Backend | null = null;
function db(): Backend {
  if (!backend) backend = redisBackend() ?? localBackend();
  return backend;
}

export const storageKind = () => db().kind;

function parseAll<T>(h: Hash): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of Object.entries(h)) {
    try {
      out[k] = JSON.parse(v) as T;
    } catch {
      /* skip corrupt entries */
    }
  }
  return out;
}

const stringifyAll = (o: Record<string, unknown>): Hash =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, JSON.stringify(v)]));

export const EMPTY_META: SyncMeta = {
  syncedAt: null,
  source: null,
  sheetNote: "",
  screenNote: "",
  excludedStates: [],
  total: 0,
  added: 0,
  removed: 0,
  unmapped: [],
};

async function recount(id: string) {
  const [contacts, notes] = await Promise.all([db().hlen(K.contacts(id)), db().hlen(K.notes(id))]);
  await db().hset(K.counts, { [id]: JSON.stringify({ contacts, notes }) });
}

export const store = {
  // ---- Sheet data (replaced on every sync) ----
  async agencies(): Promise<Record<string, Agency>> {
    return parseAll<Agency>(await db().hgetall(K.agencies));
  },
  async agency(id: string): Promise<Agency | null> {
    const v = await db().hget(K.agencies, id);
    return v ? (JSON.parse(v) as Agency) : null;
  },
  async replaceAgencies(list: Record<string, Agency>) {
    await db().replaceHash(K.agencies, stringifyAll(list));
  },
  async meta(): Promise<SyncMeta> {
    const v = await db().get(K.meta);
    return v ? { ...EMPTY_META, ...JSON.parse(v) } : EMPTY_META;
  },
  async setMeta(m: SyncMeta) {
    await db().set(K.meta, JSON.stringify(m));
  },

  // ---- Team data (never touched by sync) ----
  async statuses(): Promise<Record<string, StatusRecord>> {
    return parseAll<StatusRecord>(await db().hgetall(K.status));
  },
  async setStatus(id: string, rec: StatusRecord) {
    await db().hset(K.status, { [id]: JSON.stringify(rec) });
  },
  async overrides(): Promise<Record<string, Overrides>> {
    return parseAll<Overrides>(await db().hgetall(K.overrides));
  },
  async setOverride(id: string, patch: Overrides) {
    const cur = await db().hget(K.overrides, id);
    const next = { ...(cur ? JSON.parse(cur) : {}), ...patch };
    await db().hset(K.overrides, { [id]: JSON.stringify(next) });
  },
  async contacts(id: string): Promise<Contact[]> {
    return Object.values(parseAll<Contact>(await db().hgetall(K.contacts(id)))).sort((a, b) =>
      a.addedAt.localeCompare(b.addedAt)
    );
  },
  async saveContact(id: string, c: Contact) {
    await db().hset(K.contacts(id), { [c.id]: JSON.stringify(c) });
    await recount(id);
  },
  async contact(id: string, cid: string): Promise<Contact | null> {
    const v = await db().hget(K.contacts(id), cid);
    return v ? (JSON.parse(v) as Contact) : null;
  },
  async deleteContact(id: string, cid: string) {
    await db().hdel(K.contacts(id), cid);
    await recount(id);
  },
  async notes(id: string): Promise<Note[]> {
    return Object.values(parseAll<Note>(await db().hgetall(K.notes(id)))).sort((a, b) => b.at.localeCompare(a.at));
  },
  async addNote(id: string, n: Note) {
    await db().hset(K.notes(id), { [n.id]: JSON.stringify(n) });
    await recount(id);
  },
  async deleteNote(id: string, nid: string) {
    await db().hdel(K.notes(id), nid);
    await recount(id);
  },
  /** Contact/note counts for the list view, kept in one hash so the list loads in a single read. */
  async counts(): Promise<Record<string, { contacts: number; notes: number }>> {
    return parseAll<{ contacts: number; notes: number }>(await db().hgetall(K.counts));
  },

  // ---- Geocode cache ----
  geoCache: {
    async get(k: string): Promise<[number, number] | null> {
      const v = await db().hget(K.geo, k);
      return v ? JSON.parse(v) : null;
    },
    async set(k: string, v: [number, number]) {
      await db().hset(K.geo, { [k]: JSON.stringify(v) });
    },
  },
};

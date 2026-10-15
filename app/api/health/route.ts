import { requireAuth } from "@/lib/auth";
import { findRedisConfig, store, storageKind } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Setup check: open /api/health while signed in. Shows which settings the server can see
 * (names only, never values) and whether the database answers.
 */
export async function GET(req: Request) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const cfg = findRedisConfig();
  const storageVars = Object.keys(process.env)
    .filter((k) => /KV_|REDIS|UPSTASH/.test(k))
    .sort();
  let database: string;
  try {
    const t = Date.now();
    const meta = await store.meta();
    const agencies = Object.keys(await store.agencies()).length;
    database = `ok (${Date.now() - t} ms) · ${agencies} agencies · last sync ${meta.syncedAt ?? "never"}`;
  } catch (e) {
    database = `error: ${(e as Error).message}`;
  }
  return Response.json({
    storage: storageKind(),
    usingCredentialsFrom: cfg?.from ?? null,
    databaseHost: cfg ? new URL(cfg.url).hostname : null,
    database,
    storageVariablesFound: storageVars,
    teamPasswordSet: Boolean(process.env.TEAM_PASSWORD),
    sheetUrlSet: Boolean(process.env.SHEET_CSV_URL),
    cronSecretSet: Boolean(process.env.CRON_SECRET),
    node: process.version,
  });
}

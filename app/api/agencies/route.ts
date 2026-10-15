import { safe } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { store, storageKind } from "@/lib/store";
import type { AgencyListPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export const GET = safe("agencies GET", async (req: Request) => {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const [agencies, statuses, overrides, meta, counts] = await Promise.all([
    store.agencies(),
    store.statuses(),
    store.overrides(),
    store.meta(),
    store.counts(),
  ]);
  const list = Object.values(agencies).sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || a.name.localeCompare(b.name));
  const payload: AgencyListPayload = {
    agencies: list,
    statuses,
    overrides,
    counts,
    meta,
    storage: storageKind(),
    sheetConfigured: Boolean(process.env.SHEET_CSV_URL),
  };
  return Response.json(payload);
});

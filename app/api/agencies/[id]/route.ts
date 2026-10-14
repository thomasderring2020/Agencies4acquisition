import { requireAuth } from "@/lib/auth";
import { store } from "@/lib/store";
import { STATUSES, type Status } from "@/lib/types";
import { cleanUrl, actor } from "@/lib/validate";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id } = await params;
  const [contacts, notes] = await Promise.all([store.contacts(id), store.notes(id)]);
  return Response.json({ contacts, notes });
}

/** Update status and/or the agency's LinkedIn / website link. */
export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id } = await params;
  if (!(await store.agency(id))) return Response.json({ error: "Unknown agency" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { status?: string; linkedin?: string; website?: string; by?: string };
  const by = actor(body.by);
  const result: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status as Status)) return Response.json({ error: "Invalid status" }, { status: 400 });
    const rec = { status: body.status as Status, by, at: new Date().toISOString() };
    await store.setStatus(id, rec);
    result.status = rec;
  }
  const patch: { linkedin?: string; website?: string } = {};
  if (body.linkedin !== undefined) patch.linkedin = cleanUrl(body.linkedin);
  if (body.website !== undefined) patch.website = cleanUrl(body.website);
  if (Object.keys(patch).length) {
    await store.setOverride(id, patch);
    result.overrides = patch;
  }
  return Response.json(result);
}

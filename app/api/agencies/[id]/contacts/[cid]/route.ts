import { requireAuth } from "@/lib/auth";
import { store } from "@/lib/store";
import { contactFromBody } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string; cid: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id, cid } = await params;
  const cur = await store.contact(id, cid);
  if (!cur) return Response.json({ error: "Contact not found" }, { status: 404 });
  const fields = contactFromBody(await req.json().catch(() => ({})));
  if (!fields.name) return Response.json({ error: "Name is required" }, { status: 400 });
  const next = { ...cur, ...fields };
  await store.saveContact(id, next);
  return Response.json(next);
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id, cid } = await params;
  await store.deleteContact(id, cid);
  return new Response(null, { status: 204 });
}

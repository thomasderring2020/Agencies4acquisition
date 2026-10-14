import { requireAuth } from "@/lib/auth";
import { store } from "@/lib/store";
import { contactFromBody, actor } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id } = await params;
  if (!(await store.agency(id))) return Response.json({ error: "Unknown agency" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const fields = contactFromBody(body);
  if (!fields.name) return Response.json({ error: "Name is required" }, { status: 400 });
  const contact = { id: crypto.randomUUID(), ...fields, addedBy: actor(body.by), addedAt: new Date().toISOString() };
  await store.saveContact(id, contact);
  return Response.json(contact, { status: 201 });
}

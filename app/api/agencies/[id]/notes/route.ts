import { safe } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { store } from "@/lib/store";
import { actor } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export const POST = safe("agencies/[id]/notes POST", async (req: Request, { params }: Ctx) => {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id } = await params;
  if (!(await store.agency(id))) return Response.json({ error: "Unknown agency" }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { text?: string; by?: string };
  const text = String(body.text ?? "").trim().slice(0, 5000);
  if (!text) return Response.json({ error: "Note is empty" }, { status: 400 });
  const note = { id: crypto.randomUUID(), text, by: actor(body.by), at: new Date().toISOString() };
  await store.addNote(id, note);
  return Response.json(note, { status: 201 });
});

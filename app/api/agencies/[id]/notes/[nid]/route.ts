import { requireAuth } from "@/lib/auth";
import { store } from "@/lib/store";

type Ctx = { params: Promise<{ id: string; nid: string }> };

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await requireAuth(req);
  if (denied) return denied;
  const { id, nid } = await params;
  await store.deleteNote(id, nid);
  return new Response(null, { status: 204 });
}

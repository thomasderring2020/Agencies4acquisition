import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  return new Response(null, {
    status: 204,
    headers: { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` },
  });
}

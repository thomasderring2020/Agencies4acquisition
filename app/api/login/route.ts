import { SESSION_COOKIE, sessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const pw = process.env.TEAM_PASSWORD;
  if (!pw) return Response.json({ error: "TEAM_PASSWORD is not set on the server yet." }, { status: 500 });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (password !== pw) {
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return Response.json({ error: "Wrong password" }, { status: 401 });
  }
  const token = await sessionToken(pw);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secure}`,
    },
  });
}

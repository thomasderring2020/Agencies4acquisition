// Shared-password gate. Works in both the Edge middleware and Node route handlers.
export const SESSION_COOKIE = "mna_session";

export async function sessionToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`mna-tracker:v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** True if no password is configured (local dev only) or the cookie matches. */
export async function isAuthed(cookieValue: string | undefined): Promise<boolean> {
  const pw = process.env.TEAM_PASSWORD;
  if (!pw) return process.env.NODE_ENV !== "production";
  if (!cookieValue) return false;
  return cookieValue === (await sessionToken(pw));
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export async function requireAuth(req: Request): Promise<Response | null> {
  const ok = await isAuthed(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  return ok ? null : Response.json({ error: "Not signed in" }, { status: 401 });
}

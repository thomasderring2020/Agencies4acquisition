const clip = (v: unknown, n = 300) => String(v ?? "").trim().slice(0, n);

export function cleanUrl(v: unknown): string {
  const s = clip(v, 500);
  if (!s) return "";
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

export function actor(v: unknown): string {
  return clip(v, 80) || "Someone";
}

export function contactFromBody(body: Record<string, unknown>) {
  return {
    name: clip(body.name, 120),
    title: clip(body.title, 120),
    phone: clip(body.phone, 40),
    email: clip(body.email, 200),
    linkedin: cleanUrl(body.linkedin),
  };
}

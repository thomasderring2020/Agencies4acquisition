import { isAuthed, readCookie, SESSION_COOKIE } from "@/lib/auth";
import { fetchSheetCsv, runSync } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Weekly Vercel Cron hits this with GET + "Authorization: Bearer $CRON_SECRET". */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const ok = secret && req.headers.get("authorization") === `Bearer ${secret}`;
  if (!ok) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return Response.json(await runSync(await fetchSheetCsv(), "cron"));
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** "Sync now" (empty body) or "Upload CSV" (text/csv body) from the app. */
export async function POST(req: Request) {
  if (!(await isAuthed(readCookie(req.headers.get("cookie"), SESSION_COOKIE))))
    return Response.json({ error: "Not signed in" }, { status: 401 });
  try {
    const body = await req.text();
    const meta = body.trim() ? await runSync(body, "upload") : await runSync(await fetchSheetCsv(), "sheet");
    return Response.json(meta);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}

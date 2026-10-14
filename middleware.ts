import { NextResponse, type NextRequest } from "next/server";
import { isAuthed, SESSION_COOKIE } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (await isAuthed(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the login page, login API, the cron sync endpoint (it checks CRON_SECRET itself) and static assets.
  matcher: ["/((?!login|api/login|api/sync|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};

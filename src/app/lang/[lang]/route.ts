import { NextResponse, type NextRequest } from "next/server";
import { basePath } from "@/lib/base-path";
import { backPath } from "@/lib/return-to";
import { LANG_COOKIE, isLang } from "@/translations/languages";

// Stores the chosen language in a cookie and goes back to the page the
// visitor came from (same site only).
export async function GET(req: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  // A path like //evil.example would be read as another host.
  const back = backPath(req.headers.get("referer"), req.headers.get("host"), `${basePath}/`);
  // Relative Location: behind a proxy req.url carries the internal address.
  const res = new NextResponse(null, { status: 303, headers: { Location: back } });
  if (isLang(lang)) {
    res.cookies.set(LANG_COOKIE, lang, { path: basePath || "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  return res;
}

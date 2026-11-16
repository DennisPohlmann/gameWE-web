import { NextResponse, type NextRequest } from "next/server";
import { adminLangOf, currentAdmin, setAdminLang } from "@/lib/auth";
import { basePath } from "@/lib/base-path";
import { backPath } from "@/lib/return-to";
import { LANG_COOKIE, isLang } from "@/translations/languages";

// Stores the chosen language in a cookie and goes back to the page the
// visitor came from (same site only). Chosen in the admin area by a
// signed-in admin, it also becomes their stored admin language (My account),
// which wins there over the cookie.
export async function GET(req: NextRequest, { params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  // A path like //evil.example would be read as another host.
  const back = backPath(req.headers.get("referer"), req.headers.get("host"), `${basePath}/`);
  // Relative Location: behind a proxy req.url carries the internal address.
  const res = new NextResponse(null, { status: 303, headers: { Location: back } });
  if (isLang(lang)) {
    res.cookies.set(LANG_COOKIE, lang, { path: basePath || "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    const admin = back === `${basePath}/admin` || back.startsWith(`${basePath}/admin/`) || back.startsWith(`${basePath}/admin?`);
    const user = admin ? await currentAdmin() : null;
    if (user && (await adminLangOf(user.username)) !== lang) await setAdminLang(user.username, lang);
  }
  return res;
}

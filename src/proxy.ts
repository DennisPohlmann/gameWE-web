import { NextResponse, type NextRequest } from "next/server";
import { PATH_HEADER } from "@/lib/canonical";

// Old addresses get a real 301 here (a redirect inside a page arrives after
// the page has started, as a meta refresh):
// - HLstatsX:CE (/hlstats.php?mode=…, also below an old folder like
//   /hlstats/hlstats.php) and maps by number (/css/maps/17, now by name)
//   go to their redirect route (app/-/legacy);
// - /css/servers is the ranking's start page /css.
// Every other page gets its own path for the canonical link (app/(site)/layout.tsx).
const LEGACY = /(?:^|\/)(hlstats|index|ingame|sig|status)\.php$/;
// shortcut: a map whose name is only digits has no page, rename it in the admin area if one turns up.
const MAP_NUMBER = /^\/[^/]+\/maps\/(\d{1,10})$/;
const SERVERS = /^\/([^/]+)\/servers\/?$/;

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const legacy = LEGACY.exec(pathname);
  const map = MAP_NUMBER.exec(pathname);
  if (legacy || map) {
    const url = req.nextUrl.clone();
    url.pathname = legacy ? `/-/legacy/${legacy[1]}.php` : "/-/legacy/map";
    if (map) url.search = `?id=${map[1]}`;
    return NextResponse.rewrite(url);
  }
  const servers = SERVERS.exec(pathname);
  if (servers && servers[1] !== "admin") {
    const url = req.nextUrl.clone();
    url.pathname = `/${servers[1]}`;
    return NextResponse.redirect(url, 301);
  }
  const headers = new Headers(req.headers);
  headers.set(PATH_HEADER, pathname + req.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

// Not for Next's own files, the API and the health routes.
export const config = { matcher: ["/((?!_next/|api/|-/).*)"] };

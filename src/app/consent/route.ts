import { NextResponse, type NextRequest } from "next/server";
import { cookieSecure } from "@/lib/auth";
import { basePath } from "@/lib/base-path";
import { CONSENT_COOKIE, CONSENT_MAX_AGE, chosenCategories, parseConsent, sameOrigin, serializeConsent } from "@/lib/consent";
import { backPath } from "@/lib/return-to";

// POST /consent: stores the visitor's choice from the cookie banner, the
// settings dialog, the privacy page or a placeholder's "Always allow" in the
// necessary cookie gamewe_consent and goes back to the page the form was on.
// Works without JavaScript (plain form); with it the page sends the form
// with fetch and refreshes itself instead of loading anew.
export async function POST(req: NextRequest) {
  const host = req.headers.get("host");
  if (!sameOrigin(req.headers.get("origin"), host, req.headers.get("sec-fetch-site"))) {
    return new NextResponse("forbidden", { status: 403 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }
  const current = parseConsent(req.cookies.get(CONSENT_COOKIE)?.value);
  const allowed = chosenCategories(form, current);
  if (!allowed) return new NextResponse("bad request", { status: 400 });
  // Relative Location: behind a proxy req.url carries the internal address.
  const back = backPath(req.headers.get("referer"), host, `${basePath}/`);
  const res = new NextResponse(null, { status: 303, headers: { Location: back, "cache-control": "no-store" } });
  // Lax, not strict: with strict the browser leaves it out when a visitor
  // follows a link from another site (forum, Discord), and the page would
  // ask again and hide what they allowed. It carries no session and no
  // secret; httpOnly, as the page never reads it in the browser.
  res.cookies.set(CONSENT_COOKIE, serializeConsent(allowed), {
    path: basePath || "/",
    maxAge: CONSENT_MAX_AGE,
    sameSite: "lax",
    httpOnly: true,
    secure: await cookieSecure(),
  });
  return res;
}

// A visitor who opens the address itself gets the settings on the privacy page.
export function GET() {
  return new NextResponse(null, { status: 303, headers: { Location: `${basePath}/privacy#consent` } });
}

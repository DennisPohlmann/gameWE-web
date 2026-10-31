import { sessionIdleLeft, touchSession } from "@/lib/auth";
import { sameOrigin } from "@/lib/consent";

// Automatic sign-out of the admin area (lib/admin-idle.ts,
// components/admin/idle-logout.tsx). GET: how long the session has left
// without activity. POST: activity on an admin page, the time starts again.
// Answer {left: milliseconds, or null when the sign-out is off}; 401 without
// a valid session. Only the session cookie (httpOnly, sameSite strict)
// counts; a POST from another origin is refused.

const headers = { "cache-control": "no-store" };

function answer(left: number | null) {
  if (left === null || left <= 0) return Response.json({ left: 0 }, { status: 401, headers });
  return Response.json({ left: Number.isFinite(left) ? left : null }, { headers });
}

export async function GET() {
  return answer(await sessionIdleLeft());
}

export async function POST(req: Request) {
  if (!sameOrigin(req.headers.get("origin"), req.headers.get("host"), req.headers.get("sec-fetch-site"))) {
    return new Response("forbidden", { status: 403, headers });
  }
  return answer(await touchSession());
}

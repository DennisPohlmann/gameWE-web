import { NO_STORE, metricsAccess, metricsText } from "@/lib/health";

// Prometheus metrics; only with the metrics token (see lib/health.ts).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const access = await metricsAccess(req);
  if (access === "off") return new Response("not found\n", { status: 404, headers: NO_STORE });
  if (access === "denied") return new Response("unauthorized\n", { status: 401, headers: { ...NO_STORE, "www-authenticate": "Bearer" } });
  return new Response(await metricsText(), { headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8", ...NO_STORE } });
}

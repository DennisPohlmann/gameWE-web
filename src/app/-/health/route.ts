import { NO_STORE } from "@/lib/health";

// The web app answers (no database check), like GitLab's /-/health.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("gameWE OK\n", { headers: { "content-type": "text/plain; charset=utf-8", ...NO_STORE } });
}

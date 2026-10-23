import { NO_STORE } from "@/lib/health";

// The process is alive; for restarts by Docker, Kubernetes or systemd.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: NO_STORE });
}

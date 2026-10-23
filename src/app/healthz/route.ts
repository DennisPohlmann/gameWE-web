import { query } from "@/lib/db";

// Liveness and database check for Docker, systemd watchdogs and proxies.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await query(`SELECT 1`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "database unreachable" }, { status: 503 });
  }
}

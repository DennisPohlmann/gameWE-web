import { NO_STORE, databaseUp } from "@/lib/health";

// Ready to serve pages: the database answers. 503 otherwise.
export const dynamic = "force-dynamic";

export async function GET() {
  const db = await databaseUp();
  return Response.json(
    { status: db.up ? "ok" : "failed", checks: { database: { status: db.up ? "ok" : "failed" } } },
    { status: db.up ? 200 : 503, headers: NO_STORE },
  );
}

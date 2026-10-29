import { adminApi } from "@/lib/admin-api";

// The admin API (lib/admin-api.ts, documented in lib/openapi-admin.ts):
// every path below /api/v1/admin, authenticated with an admin's API token.
// Never cached, never static.
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ path: string[] }> };
const handle = async (req: Request, { params }: Params) => adminApi(req, (await params).path);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;

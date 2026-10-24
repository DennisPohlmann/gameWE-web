import { api } from "@/lib/api";
import { openApiDocument } from "@/lib/openapi";

// OpenAPI description of /api/v1, read by the documentation on /api.
export function GET() {
  return api(async () => openApiDocument(process.env.APP_VERSION || "0"));
}

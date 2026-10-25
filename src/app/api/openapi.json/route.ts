import { api, defaultGame } from "@/lib/api";
import { openApiDocument } from "@/lib/openapi";

// OpenAPI description of /api/v1, read by the documentation on /api. Its
// examples and "try it" requests use the first ranking of this site.
export async function GET() {
  return api(async () => openApiDocument(process.env.APP_VERSION || "0", await defaultGame()));
}

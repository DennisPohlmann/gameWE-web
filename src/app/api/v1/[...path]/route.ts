import { api } from "@/lib/api";

// Any other path under /api/v1 answers like an unknown entry, as JSON
// (404, rate limited and with CORS) instead of the website's HTML page.
export function GET() {
  return api(async () => null);
}

import { api } from "@/lib/api";
import { apiIndex } from "@/lib/openapi";

// Index of the public API; the documentation is on /api.
export function GET() {
  return api(async () => apiIndex());
}

import { api } from "@/lib/api";
import { basePath } from "@/lib/base-path";

// Index of the public API.
export function GET() {
  return api(async () => ({
    version: 1,
    endpoints: [
      `${basePath}/api/v1/rankings`,
      `${basePath}/api/v1/rankings/{game}?limit=10&offset=0`,
      `${basePath}/api/v1/rankings/{game}/servers`,
      `${basePath}/api/v1/rankings/{game}/servers/{serverId}`,
      `${basePath}/api/v1/servers`,
      `${basePath}/api/v1/players/{playerId}`,
    ],
  }));
}

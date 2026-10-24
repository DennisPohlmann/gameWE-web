import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

// Sub path the site runs under behind a reverse proxy, e.g. BASE_PATH=/new.
// Next.js bakes it in at build time, so it must be set for `npm run build`.
const basePath = (process.env.BASE_PATH ?? "").trim().replace(/\/+$/, "");
if (basePath && !/^\/[A-Za-z0-9._~\/-]+$/.test(basePath)) {
  throw new Error(`BASE_PATH must look like /new, not "${basePath}"`);
}

// The version from package.json, shown in the footer (for debugging).
const version = String(JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version ?? "");

const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone, for the systemd install.
  output: "standalone",
  poweredByHeader: false,
  basePath,
  env: { BASE_PATH: basePath, APP_VERSION: version },
  // Keep mysql2 as a real package in the standalone output, so
  // scripts/create-admin.mjs can use it on the server too.
  serverExternalPackages: ["mysql2", "pg"],
  // The old raw list "Advanced: all options" is part of the settings page now.
  async redirects() {
    return [
      { source: "/admin/options", destination: "/admin/settings", permanent: true },
      { source: "/admin/options/:path*", destination: "/admin/settings", permanent: true },
    ];
  },
};

export default nextConfig;

import { readFileSync } from "node:fs";
import type { NextConfig } from "next";
import { LANGUAGES } from "./src/translations/languages";

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
  // Files in public/ are served with "max-age=0" by default, so the browser
  // asks for every icon again on every page. The flags, game icons, icons and the
  // vendored Scalar bundle change only with a release, so the browser may
  // keep them for a day; the flags sprite, whose URL carries its version,
  // for a year.
  // Security headers on every answer: no framing by other sites
  // (clickjacking), no MIME sniffing, and only the origin as Referer for
  // other sites. HSTS belongs to the TLS proxy (docs/INSTALLATION.md).
  async headers() {
    const day = "public, max-age=86400";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "x-frame-options", value: "SAMEORIGIN" },
          { key: "content-security-policy", value: "frame-ancestors 'self'" },
          { key: "x-content-type-options", value: "nosniff" },
          { key: "referrer-policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      { source: "/flags/:path*", headers: [{ key: "cache-control", value: day }] },
      // The HTML banners (lib/banners/wide-banner.tsx) are made for an
      // <iframe> on other sites: frame-ancestors * (it overrides
      // x-frame-options in browsers); the page loads nothing but pictures of
      // this site (the map's radar picture).
      { source: "/banner/:path(.*\\.html)", headers: [{ key: "content-security-policy", value: "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; frame-ancestors *" }] },
      // After the rule above: the later rule wins for the same header.
      { source: "/flags/sprite.png", headers: [{ key: "cache-control", value: "public, max-age=31536000, immutable" }] },
      { source: "/:file(icon\\.svg|icon-32\\.png|icon-192\\.png|icon-512\\.png|apple-touch-icon\\.png|avatar-unknown\\.svg)", headers: [{ key: "cache-control", value: day }] },
      { source: "/games/:path*", headers: [{ key: "cache-control", value: day }] },
      { source: "/vendor/:path*", headers: [{ key: "cache-control", value: day }] },
    ];
  },
  // Banners in a language: the language folder right before the file
  // (/banner/<game>/player/de/12.png, /sig/de/12.png, /banner/de/teamspeak.png)
  // is the picture without it; lib/banners/options.ts reads the language.
  async rewrites() {
    const lang = LANGUAGES.map((l) => l.code).join("|");
    return [
      { source: `/banner/:game/:kind(player|server)/:lang(${lang})/:file`, destination: "/banner/:game/:kind/:file?lang=:lang" },
      { source: `/sig/:lang(${lang})/:file`, destination: "/sig/:file?lang=:lang" },
      { source: `/banner/:lang(${lang})/:file(teamspeak[^/]*)`, destination: "/banner/:file?lang=:lang" },
    ];
  },
  // The old raw list "Advanced: all options" is a settings page now.
  async redirects() {
    return [
      { source: "/admin/options", destination: "/admin/settings/raw", permanent: true },
      { source: "/admin/options/:path*", destination: "/admin/settings/raw", permanent: true },
    ];
  },
};

export default nextConfig;

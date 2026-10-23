import type { MetadataRoute } from "next";
import { basePath } from "@/lib/base-path";
import { getSettings } from "@/lib/settings";

// Read from the settings on each request, not at build time.
export const dynamic = "force-dynamic";

// Web app manifest: name and icons for "Add to home screen" on Android and
// the share sheet.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const s = await getSettings();
  const icon = s.appleIcon || `${basePath}/apple-touch-icon.png`;
  return {
    name: s.siteName,
    short_name: s.siteName.slice(0, 30),
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "browser",
    background_color: "#1b1b1b",
    theme_color: "#1b1b1b",
    icons: s.appleIcon
      ? [{ src: icon, sizes: "180x180", type: "image/png" }]
      : [
          { src: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png" },
          { src: `${basePath}/icon-512.png`, sizes: "512x512", type: "image/png" },
          { src: `${basePath}/icon.svg`, sizes: "any", type: "image/svg+xml" },
        ],
  };
}

import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";
import { statsOrigin } from "@/lib/site-url";

// /robots.txt: everything public except the admin area and helper routes
// (signature and banner pictures stay open: link previews use them);
// all blocked when SEO indexing is switched off in the admin area.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const [s, origin] = await Promise.all([getSettings(), statsOrigin()]);
  const base = new URL(`${origin}/`).pathname.replace(/\/$/, "");
  if (!s.seoIndex) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: `${base}/`, disallow: ["/admin", "/lang/", "/api/", "/avatar/"].map((p) => base + p) },
    sitemap: `${origin}/sitemap.xml`,
  };
}

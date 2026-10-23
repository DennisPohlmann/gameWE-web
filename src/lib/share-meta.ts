import "server-only";
import type { Metadata } from "next";
import { getSettings } from "./settings";

// Metadata of a profile page (player, clan, server) for sharing: the share
// text is the link preview's description and goes to the share button too
// (<meta name="share-text">). The layout's preview fields are replaced, not
// merged, so they are repeated here.
// title is the name in link previews; page (default: title) goes into the
// browser title template.
export async function shareMetadata({ title, page, text, image, noindex = false }: { title: string; page?: string; text: string; image?: string; noindex?: boolean }): Promise<Metadata> {
  const s = await getSettings();
  const fallback = s.seoImage || s.logoUrl;
  const images = image ? [image] : fallback ? [fallback] : undefined;
  return {
    title: page ?? title,
    description: text,
    robots: noindex || !s.seoIndex ? { index: false, follow: false } : undefined,
    openGraph: { type: "profile", siteName: s.siteName, title, description: text, images },
    twitter: { card: images ? "summary_large_image" : "summary", site: s.seoTwitter || undefined, title, description: text, images },
    other: { "share-text": text },
  };
}

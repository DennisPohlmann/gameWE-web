import type { MetadataRoute } from "next";
import { getGames, getSitemapPlayers } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { statsOrigin } from "@/lib/site-url";

// /sitemap.xml: start, search and help, every ranking with its sections, and
// its best 200 players.
const SECTIONS = ["", "/players", "/clans", "/awards", "/weapons", "/actions", "/maps", "/teams", "/misc"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [s, origin, games] = await Promise.all([getSettings(), statsOrigin(), getGames().catch(() => [])]);
  if (!s.seoIndex) return [];
  const out: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${origin}/search`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${origin}/help`, changeFrequency: "monthly", priority: 0.5 },
  ];
  for (const g of games) {
    for (const sec of SECTIONS) out.push({ url: `${origin}/${g.code}${sec}`, changeFrequency: "hourly", priority: sec ? 0.7 : 0.9 });
    const players = await getSitemapPlayers(g.code, 200).catch(() => []);
    for (const p of players) {
      out.push({ url: `${origin}/${g.code}/players/${p.playerId}`, lastModified: p.last_event ? new Date(Number(p.last_event) * 1000) : undefined, changeFrequency: "daily", priority: 0.5 });
    }
  }
  return out;
}

import type { MetadataRoute } from "next";
import { mapHref } from "@/components/map-link";
import { getGames, getMaps, getServers, getSitemapPlayers, unlinkedBots } from "@/lib/data";
import { hallOfFameShown } from "@/lib/hall-of-fame";
import { getSettings } from "@/lib/settings";
import { statsOrigin } from "@/lib/site-url";

// /sitemap.xml: start, search and help, every ranking with its sections
// (those of the menu that are switched on), servers and maps, and its best
// 200 players. Only the addresses the pages name as canonical.
const SECTIONS = ["", "/players", "/clans", "/awards", "/weapons", "/actions", "/maps", "/teams", "/misc", "/bans"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [s, origin, games] = await Promise.all([getSettings(), statsOrigin(), getGames(true).catch(() => [])]);
  if (!s.seoIndex) return [];
  const out: MetadataRoute.Sitemap = [
    { url: `${origin}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${origin}/search`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${origin}/help`, changeFrequency: "monthly", priority: 0.5 },
  ];
  for (const g of games) {
    const extra = [
      ...((await hallOfFameShown(g.code).catch(() => false)) ? ["/hall-of-fame"] : []),
      ...(s.gameEvents !== "off" ? ["/events"] : []),
      ...(s.chatPublic ? ["/chat"] : []),
    ];
    for (const sec of [...SECTIONS, ...extra]) out.push({ url: `${origin}/${g.code}${sec}`, changeFrequency: "hourly", priority: sec ? 0.7 : 0.9 });
    for (const sv of await getServers(g.code).catch(() => [])) out.push({ url: `${origin}/${g.code}/servers/${sv.serverId}`, changeFrequency: "hourly", priority: 0.6 });
    for (const m of await getMaps(g.code).catch(() => [])) out.push({ url: `${origin}${mapHref(g.code, m.map)}`, changeFrequency: "daily", priority: 0.4 });
    const players = await getSitemapPlayers(g.code, 200).catch(() => []);
    const bots = await unlinkedBots(players.map((p) => p.playerId)).catch(() => new Set<number>());
    for (const p of players) {
      if (bots.has(p.playerId)) continue;
      out.push({ url: `${origin}/${g.code}/players/${p.playerId}`, lastModified: p.last_event ? new Date(Number(p.last_event) * 1000) : undefined, changeFrequency: "daily", priority: 0.5 });
    }
  }
  return out;
}

import Link from "next/link";
import { GameEventsLive } from "@/components/game-events-live";
import { siteTimeZone } from "@/lib/format";
import { getPlayerFlags } from "@/lib/data";
import { getGameEvents, getMembersGameEvents, getPlayerGameEvents, hasEventServer, PLAYER_EVENTS } from "@/lib/history";
import { getSettings } from "@/lib/settings";
import type { Dict, Lang } from "@/lib/i18n";

// The latest events of a ranking on its start page: "X killed Y with Z",
// bonuses, joins, team changes; live in the browser unless the admin
// setting says static or off; "Overview" opens the events page.
// PlayerEvents: the same for one player.
export async function GameEvents({ game, t, lang }: { game: string; t: Dict; lang: Lang }) {
  const { gameEvents } = await getSettings();
  if (gameEvents === "off") return null;
  const rows = await getGameEvents(game, 10);
  const withServer = await hasEventServer();
  const flags = await getPlayerFlags(rows.flatMap((r) => [r.actor, r.other]));
  return (
    <GameEventsLive
      title={t.recentEvents}
      feed={`/${encodeURIComponent(game)}/events-feed`}
      pauseKey="gamewe-live-events"
      shown={10}
      game={game}
      lang={lang}
      timeZone={siteTimeZone()}
      live={gameEvents === "live"}
      withServer={withServer}
      initial={rows}
      initialFlags={Object.fromEntries(flags)}
      labels={{ time: t.time, eventText: t.eventText, server: t.server, map: t.map, noData: t.noData, liveData: t.liveData, liveUpdates: t.liveUpdates, evText: t.evText }}
      more={
        <>
          (
          <Link prefetch={false} className="th-link" href={`/${game}/events`}>
            {t.overview}
          </Link>
          )
        </>
      }
    />
  );
}

// The latest events with the player on either side, on the player page;
// setting "Recent kills and deaths (player page)". The caller checks that the
// page may be shown (hidden ranking, bot without profile).
export async function PlayerEvents({ game, playerId, t, lang }: { game: string; playerId: number; t: Dict; lang: Lang }) {
  const { playerEvents } = await getSettings();
  if (playerEvents === "off") return null;
  const rows = await getPlayerGameEvents(playerId, PLAYER_EVENTS);
  if (!rows.length && playerEvents !== "live") return null;
  const withServer = await hasEventServer();
  const flags = await getPlayerFlags(rows.flatMap((r) => [r.actor, r.other]));
  return (
    <GameEventsLive
      title={t.recentEvents}
      feed={`/${encodeURIComponent(game)}/players/${playerId}/events-feed`}
      pauseKey="gamewe-live-player-events"
      shown={PLAYER_EVENTS}
      game={game}
      lang={lang}
      timeZone={siteTimeZone()}
      live={playerEvents === "live"}
      withServer={withServer}
      initial={rows}
      initialFlags={Object.fromEntries(flags)}
      labels={{ time: t.time, eventText: t.eventText, server: t.server, map: t.map, noData: t.noData, liveData: t.liveData, liveUpdates: t.liveUpdates, evText: t.evText }}
      more={
        <>
          (
          <Link prefetch={false} className="th-link" href={`/${game}/players/${playerId}/events`}>
            {t.overview}
          </Link>
          )
        </>
      }
    />
  );
}

// The latest events with a member of the clan on either side, on the clan
// page; the same setting and rows as the player page's box. ids: the
// members shown on the page (hidden players are not among them).
export async function ClanEvents({ game, clanId, ids, t, lang }: { game: string; clanId: number; ids: number[]; t: Dict; lang: Lang }) {
  const { playerEvents } = await getSettings();
  if (playerEvents === "off" || !ids.length) return null;
  const rows = await getMembersGameEvents(clanId, ids, PLAYER_EVENTS);
  if (!rows.length && playerEvents !== "live") return null;
  const withServer = await hasEventServer();
  const flags = await getPlayerFlags(rows.flatMap((r) => [r.actor, r.other]));
  return (
    <GameEventsLive
      title={t.clanEvents}
      feed={`/${encodeURIComponent(game)}/clans/${clanId}/events-feed`}
      pauseKey="gamewe-live-clan-events"
      shown={PLAYER_EVENTS}
      game={game}
      lang={lang}
      timeZone={siteTimeZone()}
      live={playerEvents === "live"}
      withServer={withServer}
      initial={rows}
      initialFlags={Object.fromEntries(flags)}
      labels={{ time: t.time, eventText: t.eventText, server: t.server, map: t.map, noData: t.noData, liveData: t.liveData, liveUpdates: t.liveUpdates, evText: t.evText }}
    />
  );
}

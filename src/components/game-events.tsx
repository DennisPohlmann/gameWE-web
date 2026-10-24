import { GameEventsLive } from "@/components/game-events-live";
import { Section } from "@/components/ui";
import { getPlayerFlags } from "@/lib/data";
import { getGameEvents, hasEventServer } from "@/lib/history";
import { getSettings } from "@/lib/settings";
import type { Dict, Lang } from "@/lib/i18n";

// The latest events of a ranking on its start page: "X killed Y with Z",
// bonuses, joins, team changes; live in the browser unless the admin
// setting says static or off.
export async function GameEvents({ game, t, lang }: { game: string; t: Dict; lang: Lang }) {
  const { gameEvents } = await getSettings();
  if (gameEvents === "off") return null;
  const rows = await getGameEvents(game, 10);
  const withServer = await hasEventServer();
  const flags = await getPlayerFlags(rows.flatMap((r) => [r.actor, r.other]));
  return (
    <Section title={t.recentEvents}>
      <GameEventsLive
        game={game}
        lang={lang}
        live={gameEvents === "live"}
        withServer={withServer}
        initial={rows}
        initialFlags={Object.fromEntries(flags)}
        labels={{ time: t.time, eventText: t.eventText, server: t.server, map: t.map, noData: t.noData, evText: t.evText }}
      />
    </Section>
  );
}

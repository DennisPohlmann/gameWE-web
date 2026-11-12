import { cache } from "react";
import { rankingGate, rankingShown } from "@/lib/ranking-access";
import type { Metadata } from "next";
import { SigCode } from "@/components/sig-code";
import { bannerChoices } from "@/lib/banners/options";
import { imageStyles } from "@/lib/image-theme";
import { statsOrigin } from "@/lib/site-url";
import { notFound, redirect } from "next/navigation";
import { ServerEvents } from "@/components/game-events";
import { ServerLoadChart } from "@/components/graphics";
import { LoadSummary } from "@/components/load-summary";
import { MapLink } from "@/components/map-link";
import { LiveTable, NobodyOnline, ServerTable } from "@/components/live";
import { PlayerCount } from "@/components/player-count";
import { Empty, PlayerLink, Section, Stats, TableWrap } from "@/components/ui";
import { getChat, getLivePlayers, getPlayerFlags, getServer, getServerLoad } from "@/lib/data";
import { fmtDateTime, fmtDuration, fmtNum, fmtPct, nowUnix, ratio } from "@/lib/format";
import { playerCount } from "@/lib/player-count";
import { fill, getDict } from "@/lib/i18n";
import { shareMetadata } from "@/lib/share-meta";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ game: string; id: string }> };

// Once per request: metadata and page both need it.
const load = cache(async (raw: string) => {
  const id = Number.parseInt(raw, 10);
  const s = Number.isSafeInteger(id) && id > 0 ? await getServer(id) : undefined;
  return s && (await rankingShown(s.game)) ? s : undefined;
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await load((await params).id);
  if (!s) return {};
  const [{ t }, { siteName }] = await Promise.all([getDict(), getSettings()]);
  return shareMetadata({ title: s.name, page: `${t.servers}: ${s.name}`, text: fill(t.shareTextServer, { name: s.name, site: siteName }) });
}

export default async function ServerPage({ params }: Props) {
  await rankingGate((await params).game);
  const { game, id } = await params;
  const s = await load(id);
  if (!s) notFound();
  if (s.game !== game) redirect(`/${s.game}/servers/${s.serverId}`);
  const { lang, t } = await getDict();
  const now = nowUnix();
  const [{ chatPublic }, origin, imgStyles] = await Promise.all([getSettings(), statsOrigin(), imageStyles(lang === "de" ? "de" : "en")]);
  const [live, load24, chat] = await Promise.all([
    getLivePlayers(game, s.serverId),
    getServerLoad(s.serverId, now - 86400),
    chatPublic ? getChat({ serverId: s.serverId, shown: true, limit: 20, offset: 0 }) : Promise.resolve([]),
  ]);
  const flags = await getPlayerFlags(chat.map((c) => c.playerId));

  return (
    <>
      <Section title={t.liveView}>
        <ServerTable game={game} servers={[s]} t={t} lang={lang} />
        {load24.length > 1 ? (
          <div className="box">
            <ServerLoadChart
              points={load24}
              slots={s.max_players}
              locale={lang}
              labels={{ players: t.players, uptime: t.uptime }}
              summary={<LoadSummary points={load24} now={now} t={t} lang={lang} />}
            />
          </div>
        ) : (
          <Empty>{t.noLoadYet}</Empty>
        )}
        {live.length ? <LiveTable game={game} players={live} t={t} lang={lang} /> : <NobodyOnline t={t} />}
      </Section>
      <div>
        <Section title={t.overview}>
          <Stats
            items={[
              [t.map, <MapLink key="map" game={game} id={s.act_map_id} name={s.act_map} />],
              [t.time, s.map_started ? fmtDuration(now - s.map_started) : "-"],
              [t.playersOnline, <PlayerCount key="online" count={playerCount(s.act_players, s.bots, s.max_players)} lang={lang} botsLabel={t.bots} slots={s.max_players > 0} />],
              [t.kills, fmtNum(s.kills, lang)],
              [t.hs, `${fmtNum(s.headshots, lang)} (${fmtPct(ratio(s.headshots, s.kills), lang)})`],
              [t.suicides, fmtNum(s.suicides, lang)],
              [t.rounds, fmtNum(s.rounds, lang)],
              [t.ctTWins, `${fmtNum(s.ct_wins, lang)} / ${fmtNum(s.ts_wins, lang)}`],
              [t.bombs, `${fmtNum(s.bombs_planted, lang)} / ${fmtNum(s.bombs_defused, lang)}`],
            ]}
          />
        </Section>
        <Section title={t.serverBanner}>
          <div className="box">
            <SigCode
              base={`${origin}/banner/${game}/server/${lang}/${s.serverId}`}
              styles={imgStyles}
              {...bannerChoices("server", t)}
              link={`${origin}/${game}/servers/${s.serverId}`}
              alt={`${t.serverBanner}: ${s.name}`}
              labels={{ format: t.sigFormat, style: t.imgStyle, standard: t.imgSkinDefault, size: t.bannerSize, layout: t.bannerLayout, background: t.bannerBackground, url: t.sigImageUrl, copy: t.copy, copied: t.copied }}
            />
          </div>
        </Section>
      </div>
      <ServerEvents game={game} serverId={s.serverId} t={t} lang={lang} />
      {chat.length ? (
        <Section title={t.chat}>
          <TableWrap>
            <table>
              <tbody>
                {chat.map((c, i) => (
                  <tr key={i}>
                    <td className="muted nowrap">{fmtDateTime(c.timestamp_id, lang)}</td>
                    <td>
                      <PlayerLink game={game} id={c.playerId} name={c.name} flag={flags.get(c.playerId)} />
                    </td>
                    <td className="wrap-cell">
                      {c.message_mode === 2 ? <span className="muted">({t.sayTeam}) </span> : null}
                      {c.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      ) : null}
    </>
  );
}

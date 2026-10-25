import type { Metadata } from "next";
import { ShareBar } from "@/components/share-menu";
import { SigCode } from "@/components/sig-code";
import { imageStyles } from "@/lib/image-theme";
import { statsOrigin } from "@/lib/site-url";
import { notFound, redirect } from "next/navigation";
import { ServerLoadChart } from "@/components/graphics";
import { LiveTable, ServerTable } from "@/components/live";
import { PlayerCount } from "@/components/player-count";
import { Empty, PlayerLink, Section, Stats, TableWrap } from "@/components/ui";
import { getChat, getLivePlayers, getPlayerFlags, getServer, getServerLoad } from "@/lib/data";
import { fmtDateTime, fmtDuration, fmtNum, fmtPct, nowUnix, ratio } from "@/lib/format";
import { playerCount } from "@/lib/player-count";
import { fill, getDict } from "@/lib/i18n";
import { shareMetadata } from "@/lib/share-meta";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ game: string; id: string }> };

async function load(raw: string) {
  const id = Number.parseInt(raw, 10);
  return Number.isSafeInteger(id) && id > 0 ? getServer(id) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await load((await params).id);
  if (!s) return {};
  const [{ t }, { siteName }] = await Promise.all([getDict(), getSettings()]);
  return shareMetadata({ title: s.name, page: `${t.servers}: ${s.name}`, text: fill(t.shareTextServer, { name: s.name, site: siteName }) });
}

export default async function ServerPage({ params }: Props) {
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
    chatPublic ? getChat({ serverId: s.serverId, limit: 20, offset: 0 }) : Promise.resolve([]),
  ]);
  const flags = await getPlayerFlags(chat.map((c) => c.playerId));
  const avg = (rows: { act_players: number }[]) => (rows.length ? rows.reduce((n, r) => n + r.act_players, 0) / rows.length : null);

  return (
    <>
      <div className="page-share">
        <ShareBar labels={{ share: t.shareThis, copy: t.shareCopy, copied: t.copied, email: t.shareEmail }} />
      </div>
      <Section title={t.liveView}>
        <ServerTable game={game} servers={[s]} t={t} lang={lang} />
        {load24.length > 1 ? (
          <div className="box">
            <ServerLoadChart
              points={load24}
              slots={s.max_players}
              locale={lang}
              labels={{ players: t.players, uptime: t.uptime }}
              summary={
                <>
                  {t.avgPlayers24h}: <b>{fmtNum(avg(load24), lang, 1)}</b> · {t.lastHour}: <b>{fmtNum(avg(load24.filter((l) => l.timestamp >= now - 3600)), lang, 1)}</b> · {t.uptime}:{" "}
                  <b>{fmtDuration(load24[load24.length - 1].uptime * 60)}</b>
                </>
              }
            />
          </div>
        ) : (
          <Empty>{t.noLoadYet}</Empty>
        )}
        {live.length ? <LiveTable game={game} players={live} t={t} lang={lang} /> : <p>{t.nobodyOnline}</p>}
      </Section>
      <div>
        <Section title={t.overview}>
          <Stats
            items={[
              [t.map, s.act_map || "-"],
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
              base={`${origin}/banner/${game}/server/${s.serverId}`}
              styles={imgStyles}
              link={`${origin}/${game}/servers/${s.serverId}`}
              alt={`${t.serverBanner}: ${s.name}`}
              width={560}
              height={95}
              labels={{ format: t.sigFormat, style: t.imgStyle, standard: t.imgSkinDefault, url: t.sigImageUrl, copy: t.copy, copied: t.copied }}
            />
          </div>
        </Section>
      </div>
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

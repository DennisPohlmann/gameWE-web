import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AutoForm } from "@/components/auto-form";
import { HeatmapView } from "@/components/heatmap";
import { Empty, PlayerLink, Section, Stats, TableWrap, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { getMap, getMapTop, getPlayerFlags } from "@/lib/data";
import { fmtDuration, fmtNum, fmtPct, kpd, ratio } from "@/lib/format";
import { getHeatmap, type HeatWho } from "@/lib/heatmap";
import { fill, getDict } from "@/lib/i18n";

type Props = {
  params: Promise<{ game: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function load(raw: string) {
  const id = Number.parseInt(raw, 10);
  return Number.isSafeInteger(id) && id > 0 ? getMap(id) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const m = await load((await params).id);
  if (!m) return {};
  return { title: `${(await getDict()).t.maps}: ${m.map}` };
}

export default async function MapPage({ params, searchParams }: Props) {
  const { game, id } = await params;
  const m = await load(id);
  if (!m) notFound();
  if (m.game !== game) redirect(`/${m.game}/maps/${m.id}`);
  const { lang, t } = await getDict();
  // Heatmap of where players die (default) or where the killers stood.
  const who: HeatWho = strParam((await searchParams).pos) === "killer" ? "killer" : "victim";
  const [top, heat] = await Promise.all([getMapTop(m.id, 30), getHeatmap(m.id, who)]);
  const flags = await getPlayerFlags(top.map((r) => r.playerId));
  const base = `/${game}/maps/${m.id}`;
  return (
    <>
      <Section title={m.map}>
        <Stats
          title={t.overview}
          items={[
            [t.played, fmtNum(m.played, lang)],
            [t.rounds, fmtNum(m.rounds, lang)],
            ...(m.play_time ? ([[t.time, fmtDuration(m.play_time)]] as [string, string][]) : []),
            [t.kills, fmtNum(m.kills, lang)],
            [t.hs, `${fmtNum(m.headshots, lang)} (${fmtPct(ratio(m.headshots, m.kills), lang)})`],
            [t.teamkills, fmtNum(m.teamkills, lang)],
            ...(m.teama_wins || m.teamb_wins
              ? ([[t.teamWins, `${fmtNum(m.teama_wins, lang)} / ${fmtNum(m.teamb_wins, lang)}`]] as [string, string][])
              : []),
          ]}
        />
      </Section>
      <Section title={t.heatmap}>
        {/* One box: the hint and the deaths/kills choice on top, the map below. */}
        <div className="box heat-box">
          <div className="heat-head">
            <p className="lead">
              {heat ? fill(who === "victim" ? t.heatHintDeaths : t.heatHintKills, { n: fmtNum(heat.total, lang) }) : t.heatNone}
            </p>
            <AutoForm action={base} className="search">
              <select {...noAutofill} name="pos" defaultValue={who === "killer" ? "killer" : ""} aria-label={t.heatmap}>
                <option value="">{t.heatDeaths}</option>
                <option value="killer">{t.heatKills}</option>
              </select>
              <noscript>
                <button type="submit">{t.show}</button>
              </noscript>
            </AutoForm>
          </div>
          {heat ? (
            <HeatmapView heat={heat} label={`${t.heatmap} ${m.map}`} tip={(n) => fill(who === "victim" ? t.heatTipDeaths : t.heatTipKills, { n: fmtNum(n, lang) })} />
          ) : null}
        </div>
      </Section>
      <Section title={t.topPlayers} aside={t.last30}>
        {top.length ? (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>{t.player}</th>
                  <th className="num">{t.kills}</th>
                  <th className="num">{t.deaths}</th>
                  <th className="num">{t.kpd}</th>
                  <th className="num">{t.hpk}</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r, i) => (
                  <tr key={r.playerId}>
                    <td className="rank">{i + 1}</td>
                    <td>
                      <PlayerLink game={game} id={r.playerId} name={r.name} flag={flags.get(r.playerId)} />
                    </td>
                    <td className="num">{fmtNum(r.a, lang)}</td>
                    <td className="num">{fmtNum(r.b, lang)}</td>
                    <td className="num">{fmtNum(kpd(r.a, r.b), lang, 2)}</td>
                    <td className="num">{fmtPct(ratio(r.c, r.a), lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <Empty>{t.noData}</Empty>
        )}
      </Section>
    </>
  );
}

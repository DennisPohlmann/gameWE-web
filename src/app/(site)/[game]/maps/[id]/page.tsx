import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AutoForm } from "@/components/auto-form";
import { HeatmapView, type HeatShow } from "@/components/heatmap";
import { MiniAvatar } from "@/components/mini-avatar";
import { Rich } from "@/components/rich";
import { SortInputs } from "@/components/sort-head";
import { Empty, Pager, PctBar, PlayerLink, ROW_OPTIONS, Section, SortTh, Stats, TableWrap, WinRatioBar, pageParam, rowsParam, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { basePath } from "@/lib/base-path";
import { countMapKillers, getMap, getMapAccuracy, getMapGgWins, getMapLoadTime, getMapPlayerTable, getMapWins, getPlayerFlags } from "@/lib/data";
import { fmtDuration, fmtNum, fmtPct, kpd, localeOf, ratio } from "@/lib/format";
import { DOTS, getHeatmap } from "@/lib/heatmap";
import { fill, getDict } from "@/lib/i18n";
import { kpm, mapPlayTime, mapSort } from "@/lib/map-table";
import { getSettings } from "@/lib/settings";

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

// gameME's map page: the map's details (time, CT/T win ratio, kills, kills
// per minute, headshots, accuracy; time also from the server load rows,
// accuracy only from per-map player stats, which the collector does not
// write), the heatmap, then every player with a
// kill on the map (all time, hidden players only counted), sortable and
// paged.
export default async function MapPage({ params, searchParams }: Props) {
  const { game, id } = await params;
  const m = await load(id);
  if (!m) notFound();
  if (m.game !== game) redirect(`/${m.game}/maps/${m.id}`);
  const sp = await searchParams;
  const { lang, t } = await getDict();
  // Heatmap of kills and deaths (default), only where the killers stood or
  // only where players died.
  const pos = strParam(sp.pos);
  const show: HeatShow = pos === "killer" || pos === "victim" ? pos : "all";
  const { sort, flipped, desc } = mapSort(strParam(sp.sort), strParam(sp.dir));
  const page = pageParam(sp.page);
  const { pageSize } = await getSettings();
  const limit = rowsParam(sp.rows, pageSize);
  const [players, counts, heat, wins, accuracy, loadTime] = await Promise.all([
    getMapPlayerTable(game, m.id, sort, desc, limit, (page - 1) * limit),
    countMapKillers(m.id),
    getHeatmap(m.id),
    getMapWins(game).catch(() => new Map<number, { ct: number; t: number }>()),
    getMapAccuracy(m.id).catch(() => null),
    getMapLoadTime(m.id).catch(() => 0),
  ]);
  const ids = players.map((r) => r.playerId);
  const [flags, gg] = await Promise.all([getPlayerFlags(ids), getMapGgWins(game, m.id, ids)]);
  const w = wins.get(m.id);
  const time = mapPlayTime(m.play_time, loadTime);
  const perMin = kpm(m.kills, time);
  const base = `/${game}/maps/${m.id}`;
  const maps = `/${game}/maps`;
  const back = (
    <Link href={maps}>
      {t.backTo} {t.maps}
    </Link>
  );
  // Sorting and paging keep the heatmap choice and the rows per page.
  const keep = { pos: show !== "all" ? show : undefined, rows: limit !== pageSize ? limit : undefined, sort: sort !== "kills" ? sort : undefined, dir: flipped ? "asc" : undefined };
  const sortProps = { current: sort, asc: flipped, base, params: { pos: keep.pos, rows: keep.rows } };
  const th = (label: string, k: string, cls = "num") => <SortTh label={label} sortKey={k} className={cls} {...sortProps} />;
  const pages = Math.max(1, Math.ceil(counts.players / limit));
  return (
    <>
      <Section title={t.mapDetails} aside={back}>
        <div className="box map-details">
          <div className="map-image" role="img" aria-label={m.map}>
            ?
          </div>
          <div className="map-facts">
            <h3>{m.map}</h3>
            <Stats
              items={[
                [t.time, time ? fmtDuration(time) : "–"],
                [t.winRatio, <WinRatioBar key="w" ct={w?.ct ?? 0} t={w?.t ?? 0} labels={{ ct: t.sideCt, t: t.sideT, noData: t.winNoData }} />],
                [t.kills, fmtNum(m.kills, lang)],
                [t.kpm, perMin === null ? "–" : fmtNum(perMin, lang, 2)],
                [t.headshotsLabel, `${fmtNum(m.headshots, lang)} (${t.hpk}: ${fmtPct(ratio(m.headshots, m.kills), lang)})`],
                [t.acc, accuracy === null ? "–" : fmtPct(accuracy, lang)],
              ]}
            />
          </div>
        </div>
      </Section>
      <Section title={t.heatmap}>
        {/* One box: the hint and the deaths/kills choice on top, the map below. */}
        <div className="box heat-box">
          <div className="heat-head">
            <p className="lead">
              {heat
                ? fill(show === "victim" ? t.heatHintDeaths : show === "killer" ? t.heatHintKills : t.heatHint, {
                    kills: fmtNum(heat.kills, lang),
                    deaths: fmtNum(heat.deaths, lang),
                  })
                : t.heatNone}
              {heat && ((show !== "victim" && heat.kills > DOTS) || (show !== "killer" && heat.deaths > DOTS)) ? ` ${fill(t.heatLatest, { n: fmtNum(DOTS, lang) })}` : null}
            </p>
            <AutoForm action={base} className="search">
              <select {...noAutofill} name="pos" defaultValue={show === "all" ? "" : show} aria-label={t.heatmap}>
                <option value="">{t.heatAll}</option>
                <option value="killer">{t.heatKills}</option>
                <option value="victim">{t.heatDeaths}</option>
              </select>
              {/* Switching the heatmap keeps the table's order and rows. */}
              <SortInputs keep={{ sort: keep.sort, dir: keep.dir, rows: keep.rows ? String(keep.rows) : undefined }} />
              <noscript>
                <button type="submit">{t.show}</button>
              </noscript>
            </AutoForm>
          </div>
          {heat ? (
            <HeatmapView heat={heat} show={show} label={`${t.heatmap} ${m.map}`} title={m.map} labels={{ kills: t.heatKills, headshots: t.headshotsLabel, deaths: t.heatDeaths }} />
          ) : null}
        </div>
      </Section>
      <Section title={t.players} aside={back}>
        <p className="lead">
          {m.map}:{" "}
          <Rich text={fill(t.mapTotal, { kills: fmtNum(m.kills, lang), hidden: fmtNum(counts.hiddenKills, lang), hs: fmtNum(m.headshots, lang) })} />
        </p>
        {players.length ? (
          <>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th className="num">#</th>
                    {th(t.player, "name", "")}
                    {th(t.position, "position", "num hide-sm")}
                    {gg ? <th className="num hide-sm">{t.ggWins}</th> : null}
                    {th(t.kills, "kills")}
                    {th(t.deaths, "deaths", "num hide-sm")}
                    {th(t.kpd, "kpd")}
                    {th(t.hs, "hs", "num hide-sm")}
                    {th(t.hpk, "hpk", "barcell")}
                  </tr>
                </thead>
                <tbody>
                  {players.map((r, i) => {
                    const flag = flags.get(r.playerId);
                    return (
                      <tr key={r.playerId}>
                        <td className="rank">{fmtNum((page - 1) * limit + i + 1, lang)}</td>
                        <td>
                          <MiniAvatar src={flag?.flag === "bot" ? null : `${basePath}/avatar/${r.playerId}`} fallback={`${basePath}/avatar-unknown.svg`} />{" "}
                          <PlayerLink game={game} id={r.playerId} name={r.name} flag={flag} />
                        </td>
                        <td className="num hide-sm">{r.rank ? fmtNum(r.rank, lang) : "–"}</td>
                        {gg ? <td className="num hide-sm">{fmtNum(gg.get(r.playerId) ?? 0, lang)}</td> : null}
                        <td className="num">{fmtNum(r.kills, lang)}</td>
                        <td className="num hide-sm">{fmtNum(r.deaths, lang)}</td>
                        <td className="num">{fmtNum(kpd(r.kills, r.deaths), lang, 2)}</td>
                        <td className="num hide-sm">{fmtNum(r.headshots, lang)}</td>
                        <td className="barcell">
                          <PctBar value={ratio(r.headshots, r.kills)} lang={lang} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
            <Pager base={base} params={keep} page={page} pages={pages} total={counts.players} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
          </>
        ) : (
          <Empty>{t.noData}</Empty>
        )}
      </Section>
    </>
  );
}

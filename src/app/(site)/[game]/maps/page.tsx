import type { Metadata } from "next";
import Link from "next/link";
import { Rich } from "@/components/rich";
import { Empty, PctBar, Section, SortTh, TableWrap, WinRatioBar, strParam } from "@/components/ui";
import { getGame, getMapWins, getMaps, type MapRow } from "@/lib/data";
import { fmtDuration, fmtNum, ratio } from "@/lib/format";
import { fill, getDict } from "@/lib/i18n";
import { relativeFill } from "@/lib/shares";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.maps };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

// Games whose rounds are won by a side (CT or T): the win ratio column is
// shown there even before the first recorded round win.
const SIDE_GAMES = new Set(["css", "csgo", "cstrike"]);

// Sort keys of the column heads; default most kills first.
const SORTS: Record<string, (m: MapRow) => number | string> = {
  map: (m) => m.map.toLowerCase(),
  played: (m) => m.played,
  time: (m) => m.play_time,
  rounds: (m) => m.rounds,
  kills: (m) => m.kills,
  headshots: (m) => m.headshots,
  hpk: (m) => ratio(m.headshots, m.kills) ?? 0,
};

// gameME's maps list: time, kills and headshots with their share of all
// maps of the ranking (not only the rows shown), the CT/T round wins and
// headshots per kill. The share bars are filled relative to the largest
// share of the list, the label shows the real share.
export default async function MapsPage({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: SP }) {
  const { game } = await params;
  const sp = await searchParams;
  const { lang, t } = await getDict();
  const [rows, wins, g] = await Promise.all([getMaps(game), getMapWins(game).catch(() => new Map<number, { ct: number; t: number }>()), getGame(game)]);
  const rawSort = strParam(sp.sort);
  const sort = Object.hasOwn(SORTS, rawSort) ? rawSort : "kills";
  // Names read best A to Z, numbers biggest first; ?dir=asc flips it.
  const flipped = strParam(sp.dir) === "asc";
  const asc = flipped !== (sort === "map");
  const key = SORTS[sort];
  const sorted = [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const c = typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y);
    return (asc ? c : -c) || a.id - b.id;
  });
  // Totals over all maps of the ranking, for the shares.
  const total = { time: 0, kills: 0, hs: 0 };
  for (const m of rows) {
    total.time += m.play_time;
    total.kills += m.kills;
    total.hs += m.headshots;
  }
  const share = (m: MapRow) => ({ time: ratio(m.play_time, total.time), kills: ratio(m.kills, total.kills), hs: ratio(m.headshots, total.hs) });
  const max = { time: 0, kills: 0, hs: 0 };
  for (const m of rows) {
    const s = share(m);
    max.time = Math.max(max.time, s.time ?? 0);
    max.kills = Math.max(max.kills, s.kills ?? 0);
    max.hs = Math.max(max.hs, s.hs ?? 0);
  }
  const hasTime = total.time > 0;
  const hasWins = wins.size > 0 || SIDE_GAMES.has(g?.realgame ?? "");
  const winLabels = { ct: t.sideCt, t: t.sideT, noData: t.winNoData };
  const base = `/${game}/maps`;
  const sortProps = { current: sort, asc: flipped, base, params: { sort } };
  const th = (label: string, k: string, cls = "num") => <SortTh label={label} sortKey={k} className={cls} {...sortProps} />;
  return (
    <Section title={t.maps} aside={`${fmtNum(total.kills, lang)} ${t.kills}`}>
      {rows.length ? (
        <>
          <p className="lead">
            <Rich text={fill(t.weaponsTotal, { kills: fmtNum(total.kills, lang), hs: fmtNum(total.hs, lang) })} />
          </p>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  {th(t.map, "map", "")}
                  {th(t.played, "played", "num hide-sm")}
                  {hasTime ? th(t.time, "time", "num hide-sm") : null}
                  {hasTime ? <th className="barcell hide-sm">{t.timePct}</th> : null}
                  {hasWins ? <th className="barcell">{t.winRatio}</th> : null}
                  {th(t.rounds, "rounds", "num hide-sm")}
                  {th(t.kills, "kills")}
                  <th className="barcell">{t.killsPct}</th>
                  {th(t.headshotsLabel, "headshots", "num hide-sm")}
                  <th className="barcell hide-sm">{t.headshotsPct}</th>
                  {th(t.hpk, "hpk", "barcell")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((m, i) => {
                  const s = share(m);
                  const w = wins.get(Number(m.id));
                  return (
                    <tr key={m.id}>
                      <td className="rank">{i + 1}</td>
                      <td>
                        <Link className="player" href={`/${game}/maps/${m.id}`}>
                          {m.map}
                        </Link>
                      </td>
                      <td className="num hide-sm">{fmtNum(m.played, lang)}</td>
                      {hasTime ? <td className="num hide-sm">{fmtDuration(m.play_time)}</td> : null}
                      {hasTime ? (
                        <td className="barcell hide-sm">
                          <PctBar value={s.time} fill={relativeFill(s.time, max.time)} lang={lang} tone="share" />
                        </td>
                      ) : null}
                      {hasWins ? (
                        <td className="barcell">
                          <WinRatioBar ct={w?.ct ?? 0} t={w?.t ?? 0} labels={winLabels} />
                        </td>
                      ) : null}
                      <td className="num hide-sm">{fmtNum(m.rounds, lang)}</td>
                      <td className="num">{fmtNum(m.kills, lang)}</td>
                      <td className="barcell">
                        <PctBar value={s.kills} fill={relativeFill(s.kills, max.kills)} lang={lang} tone="share" />
                      </td>
                      <td className="num hide-sm">{fmtNum(m.headshots, lang)}</td>
                      <td className="barcell hide-sm">
                        <PctBar value={s.hs} fill={relativeFill(s.hs, max.hs)} lang={lang} tone="share" />
                      </td>
                      <td className="barcell">
                        <PctBar value={ratio(m.headshots, m.kills)} lang={lang} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </>
      ) : (
        <Empty>{t.noData}</Empty>
      )}
    </Section>
  );
}

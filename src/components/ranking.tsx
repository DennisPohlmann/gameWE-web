import { Flag, PctBar, PlayerLink, SortTh, TableWrap } from "@/components/ui";
import Link from "next/link";
import type { PlaceRow, RankingRow } from "@/lib/data";
import { activity, fmtDate, fmtDuration, fmtNum, fmtPct, kpd, ratio } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";

type SortProps = { current: string; asc: boolean; base: string; params: Record<string, string | number | undefined> };

// Player table used by the ranking and the clan page. Without `sort` the
// headers are plain text.
export function RankingTable({
  game,
  rows,
  firstRank,
  showRank = true,
  showFirstConnect = false,
  showGlobalRank = false,
  sort,
  activityDays,
  t,
  lang,
}: {
  game: string;
  rows: RankingRow[];
  firstRank: number;
  showRank?: boolean;
  showFirstConnect?: boolean;
  // Country or city ranking: also the place in the whole ranking.
  showGlobalRank?: boolean;
  sort?: SortProps;
  activityDays: number;
  t: Dict;
  lang: Lang;
}) {
  const th = (label: string, key: string, cls = "num") =>
    sort ? (
      <SortTh label={label} sortKey={key} className={cls} {...sort} />
    ) : (
      <th className={cls}>{label}</th>
    );
  return (
    <TableWrap>
      <table>
        <thead>
          <tr>
            {showRank ? <th className="num">#</th> : null}
            {th(t.name, "name", "")}
            {showGlobalRank ? <th className="num hide-sm">{t.globalRank}</th> : null}
            {th(t.points, "skill")}
            {showFirstConnect ? th(t.firstConnect, "new") : th(t.activity, "activity", "barcell hide-sm")}
            {th(t.time, "time", "num hide-sm")}
            {th(t.kills, "kills")}
            {th(t.deaths, "deaths", "num hide-sm")}
            {th(t.kpd, "kpd")}
            {th(t.hs, "hs", "num hide-sm")}
            {th(t.hpk, "hpk", "barcell")}
            {th(t.acc, "acc", "barcell hide-sm")}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const act = activity(r.last_event, activityDays);
            return (
              <tr key={r.playerId}>
                {showRank ? <td className="rank">{fmtNum(firstRank + i, lang)}</td> : null}
                <td>
                  <Flag code={r.flag} title={r.country} />
                  <PlayerLink game={game} id={r.playerId} name={r.name} />
                </td>
                {showGlobalRank ? <td className="num hide-sm">{fmtNum(Number(r.globalRank ?? 0), lang)}</td> : null}
                <td className="num">{fmtNum(r.skill, lang)}</td>
                {showFirstConnect ? (
                  <td className="num">{fmtDate(r.first_connect, lang)}</td>
                ) : (
                  <td className="barcell hide-sm">
                    <PctBar value={act / 100} lang={lang} tone="activity" />
                  </td>
                )}
                <td className="num hide-sm">{fmtDuration(r.connection_time)}</td>
                <td className="num">{fmtNum(r.kills, lang)}</td>
                <td className="num hide-sm">{fmtNum(r.deaths, lang)}</td>
                <td className="num">{fmtNum(kpd(r.kills, r.deaths), lang, 2)}</td>
                <td className="num hide-sm">{fmtNum(r.headshots, lang)}</td>
                <td className="barcell">
                  <PctBar value={ratio(r.headshots, r.kills)} lang={lang} />
                </td>
                <td className="barcell hide-sm">
                  <PctBar value={ratio(r.hits, r.shots)} lang={lang} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </TableWrap>
  );
}

// Ranking of countries or cities; each row links to the players of that place.
export function PlaceTable({
  game,
  rows,
  cities,
  firstRank,
  sort,
  t,
  lang,
}: {
  game: string;
  rows: PlaceRow[];
  cities: boolean;
  firstRank: number;
  sort: SortProps;
  t: Dict;
  lang: Lang;
}) {
  const th = (label: string, key: string, cls = "num") => <SortTh label={label} sortKey={key} className={cls} {...sort} />;
  return (
    <TableWrap>
      <table>
        <thead>
          <tr>
            <th className="num">#</th>
            {th(cities ? t.placeCity : t.placeCountry, "name", "")}
            {th(t.players, "players")}
            {th(t.avgPoints, "avg")}
            {th(t.totalPoints, "skill", "num hide-sm")}
            {th(t.time, "time", "num hide-sm")}
            {th(t.kills, "kills")}
            {th(t.deaths, "deaths", "num hide-sm")}
            {th(t.kpd, "kpd")}
            {th(t.hpk, "hpk", "barcell hide-sm")}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.code}|${r.city}`}>
              <td className="rank">{fmtNum(firstRank + i, lang)}</td>
              <td>
                <Flag code={r.code} title={r.name} />
                <Link href={placeHref(game, r.code, cities ? r.city : "")}>{cities ? r.city : r.name || r.code.toUpperCase()}</Link>
              </td>
              <td className="num">{fmtNum(r.players, lang)}</td>
              <td className="num">{fmtNum(r.avgSkill, lang)}</td>
              <td className="num hide-sm">{fmtNum(r.skill, lang)}</td>
              <td className="num hide-sm">{fmtDuration(r.connection_time)}</td>
              <td className="num">{fmtNum(r.kills, lang)}</td>
              <td className="num hide-sm">{fmtNum(r.deaths, lang)}</td>
              <td className="num">{fmtNum(kpd(r.kills, r.deaths), lang, 2)}</td>
              <td className="barcell hide-sm">
                <PctBar value={ratio(r.headshots, r.kills)} lang={lang} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

// Players of a country or city, in gameME's link form
// (/<game>/players?type=countryinfo&valuecountry=de, ...?type=cityinfo&valuecity=madrid);
// city links also name the country, as a city name can exist twice.
export function placeHref(game: string, country: string, city = ""): string {
  const c = country.toLowerCase();
  const q = new URLSearchParams(city ? { type: "cityinfo", ...(c ? { valuecountry: c } : {}), valuecity: city.toLowerCase() } : { type: "countryinfo", valuecountry: c });
  return `/${game}/players?${q}`;
}

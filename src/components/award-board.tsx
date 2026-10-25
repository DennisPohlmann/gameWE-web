import Link from "next/link";
import { Empty, PlayerLink, Section, TableWrap } from "@/components/ui";
import { sortHeads } from "@/components/sort-head";
import { awardValue, getAwardBoard, getAwardDay, type AwardBoardRow } from "@/lib/awards";
import { fmtDuration, fmtNum, localeOf } from "@/lib/format";
import { fill, type Dict, type Lang } from "@/lib/i18n";
import { sortRows, sortState } from "@/lib/table-sort";

type SP = Record<string, string | string[] | undefined>;
// Where the table is shown, so its heads can sort it: the page's query
// params and the ones to keep in the links.
type Sortable = { sp: SP; base: string; params: Record<string, string | undefined> };

// Sort keys of the award tables; by default the order of the awards.
const awardValues = {
  order: () => 0,
  award: (a: AwardBoardRow) => a.name,
  winner: (a: AwardBoardRow) => a.winner?.name ?? null,
  leader: (a: AwardBoardRow) => a.leader?.name ?? null,
};

// The board has its own param names: it shares the ranking's start page
// with the sortable server list.
const BOARD = { sortParam: "asort", dirParam: "adir" };

// The board's sort params of the current URL, for the other links of a page.
export function awardBoardKeep(sp: SP) {
  return sortState(sp, awardValues, "order", BOARD).keep;
}

// All awards of a ranking with yesterday's winner and today's leader.
export async function AwardBoard({ game, t, lang, sort }: { game: string; t: Dict; lang: Lang; sort?: Sortable }) {
  const { day, rows: loaded, flags } = await getAwardBoard(game);
  const order = sortState(sort?.sp ?? {}, awardValues, "order", BOARD);
  const rows = sortRows(loaded, awardValues, order.sort, order.asc);
  const sorted = sort ? sortHeads(order, sort.base, { ...sort.params, ...order.keep }, BOARD) : null;
  const th = (label: string, key: keyof typeof awardValues) => (sorted ? sorted(label, key, "") : <th>{label}</th>);
  const val = (a: (typeof rows)[number], v: number) => awardValue(a, v, (n) => fmtNum(n, lang), fmtDuration);
  return (
    <Section title={t.dailyAwards}>
      {rows.length ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                {th(t.award, "award")}
                {th(fill(t.winnerOf, { day }), "winner")}
                {th(t.todaysLeader, "leader")}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.awardId}>
                  <td>
                    <Link href={`/${game}/awards?view=ribbons&award=${a.awardId}`}>{a.name}</Link>
                  </td>
                  <td>
                    {a.winner ? (
                      <>
                        <PlayerLink game={game} id={a.winner.playerId} name={a.winner.name} flag={flags.get(a.winner.playerId)} />{" "}
                        <span className="muted">({val(a, a.winner.value)})</span>
                      </>
                    ) : (
                      <span className="muted">{t.notAwarded}</span>
                    )}
                  </td>
                  <td>
                    {a.leader ? (
                      <>
                        <PlayerLink game={game} id={a.leader.playerId} name={a.leader.name} flag={flags.get(a.leader.playerId)} />{" "}
                        <span className="muted">({val(a, a.leader.value)})</span>
                      </>
                    ) : (
                      <span className="muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <Empty>{t.notAwarded}</Empty>
      )}
    </Section>
  );
}


// The winners of one chosen day (calendar on the awards page).
export async function AwardDayTable({ game, day, t, lang, sort }: { game: string; day: string; t: Dict; lang: Lang; sort?: Sortable }) {
  const { rows: loaded, flags } = await getAwardDay(game, day);
  const order = sortState(sort?.sp ?? {}, awardValues, "order");
  const rows = sortRows(loaded, awardValues, order.sort, order.asc);
  const sorted = sort ? sortHeads(order, sort.base, { ...sort.params, ...order.keep }) : null;
  const th = (label: string, key: keyof typeof awardValues) => (sorted ? sorted(label, key, "") : <th>{label}</th>);
  const val = (a: (typeof rows)[number], v: number) => awardValue(a, v, (n) => fmtNum(n, lang), fmtDuration);
  const title = new Date(`${day}T00:00:00Z`).toLocaleDateString(localeOf(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <Section title={fill(t.awardsOfDay, { day: title })}>
      {rows.some((a) => a.winner) ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                {th(t.award, "award")}
                {th(t.winner, "winner")}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const f = a.winner ? flags.get(a.winner.playerId) : undefined;
                return (
                  <tr key={a.awardId}>
                    <td>
                      <Link href={`/${game}/awards?view=ribbons&award=${a.awardId}`}>{a.name}</Link>
                    </td>
                    <td>
                      {a.winner ? (
                        <>
                          <PlayerLink game={game} id={a.winner.playerId} name={a.winner.name} flag={f} />{" "}
                          <span className="muted">({val(a, a.winner.value)})</span>
                        </>
                      ) : (
                        <span className="muted">{t.notAwarded}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <Empty>{t.notAwarded}</Empty>
      )}
    </Section>
  );
}

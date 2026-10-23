import Link from "next/link";
import { Empty, Flag, PlayerLink, Section, TableWrap } from "@/components/ui";
import { awardValue, getAwardBoard, getAwardDay } from "@/lib/awards";
import { fmtDuration, fmtNum, localeOf } from "@/lib/format";
import { fill, type Dict, type Lang } from "@/lib/i18n";

// All awards of a ranking with yesterday's winner and today's leader.
export async function AwardBoard({ game, t, lang }: { game: string; t: Dict; lang: Lang }) {
  const { day, rows, flags } = await getAwardBoard(game);
  const flag = (id: number) => {
    const f = flags.get(id);
    return f ? <Flag code={f.flag} title={f.country} /> : null;
  };
  const val = (a: (typeof rows)[number], v: number) => awardValue(a, v, (n) => fmtNum(n, lang), fmtDuration);
  return (
    <Section title={t.dailyAwards}>
      {rows.length ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>{t.award}</th>
                <th>{fill(t.winnerOf, { day })}</th>
                <th>{t.todaysLeader}</th>
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
                        {flag(a.winner.playerId)} <PlayerLink game={game} id={a.winner.playerId} name={a.winner.name} />{" "}
                        <span className="muted">({val(a, a.winner.value)})</span>
                      </>
                    ) : (
                      <span className="muted">{t.notAwarded}</span>
                    )}
                  </td>
                  <td>
                    {a.leader ? (
                      <>
                        {flag(a.leader.playerId)} <PlayerLink game={game} id={a.leader.playerId} name={a.leader.name} />{" "}
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
export async function AwardDayTable({ game, day, t, lang }: { game: string; day: string; t: Dict; lang: Lang }) {
  const { rows, flags } = await getAwardDay(game, day);
  const val = (a: (typeof rows)[number], v: number) => awardValue(a, v, (n) => fmtNum(n, lang), fmtDuration);
  const title = new Date(`${day}T00:00:00Z`).toLocaleDateString(localeOf(lang), { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <Section title={fill(t.awardsOfDay, { day: title })}>
      {rows.some((a) => a.winner) ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>{t.award}</th>
                <th>{t.winner}</th>
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
                          {f ? <Flag code={f.flag} title={f.country} /> : null} <PlayerLink game={game} id={a.winner.playerId} name={a.winner.name} />{" "}
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

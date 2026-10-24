import Link from "next/link";
import { Empty, PlayerLink, Section, TableWrap } from "@/components/ui";
import { Weapon, type WeaponSet } from "@/components/weapon";
import { awardValue, getAwardBoard, getAwardDay } from "@/lib/awards";
import { fmtDuration, fmtNum, localeOf } from "@/lib/format";
import { getGame } from "@/lib/data";
import { fill, type Dict, type Lang } from "@/lib/i18n";
import { weaponImages } from "@/lib/weapons";

// All awards of a ranking with yesterday's winner and today's leader.
export async function AwardBoard({ game, t, lang }: { game: string; t: Dict; lang: Lang }) {
  const [{ day, rows, flags }, images] = await Promise.all([getAwardBoard(game), awardImages(game)]);
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
                    <AwardName game={game} a={a} images={images} />
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
export async function AwardDayTable({ game, day, t, lang }: { game: string; day: string; t: Dict; lang: Lang }) {
  const [{ rows, flags }, images] = await Promise.all([getAwardDay(game, day), awardImages(game)]);
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
                      <AwardName game={game} a={a} images={images} />
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

const awardImages = async (game: string) => weaponImages((await getGame(game, true))?.realgame);

// A weapon award (type W, its code is the weapon's) shows the weapon's image
// in front of its name.
function AwardName({ game, a, images }: { game: string; a: { awardId: number; awardType: string; code: string; name: string }; images: WeaponSet | null }) {
  const weapon = a.awardType === "W" && images && Object.hasOwn(images.sizes, a.code.trim().toLowerCase());
  return (
    <Link href={`/${game}/awards?view=ribbons&award=${a.awardId}`}>
      {weapon ? (
        <>
          <Weapon set={images} code={a.code} name={a.name} height={20} />{" "}
        </>
      ) : null}
      {a.name}
    </Link>
  );
}

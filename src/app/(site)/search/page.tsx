import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Empty, PlayerLink, Section, TableWrap, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { getGames, searchClans, searchPlayers, unlinkedBots, type ClanHit, type SearchHit, type SearchIn } from "@/lib/data";
import { fmtNum, kpd } from "@/lib/format";
import { fill, getDict } from "@/lib/i18n";
import { sortHeads, SortInputs } from "@/components/sort-head";
import { sortRows, sortState } from "@/lib/table-sort";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.searchTitle };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

const SEARCH_IN: SearchIn[] = ["names", "uniqueid", "clans"];
const LIMIT = 100;

// gameME's search page: a text, where to look and in which ranking.
export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { lang, t } = await getDict();
  const games = await getGames(true);
  const q = strParam(sp.q).trim().slice(0, 64);
  const rawIn = strParam(sp.st);
  const by: SearchIn = SEARCH_IN.find((s) => s === rawIn) ?? "names";
  const rawGame = strParam(sp.game);
  const game = games.some((g) => g.code === rawGame) ? rawGame : "";
  const gameName = new Map(games.map((g) => [g.code, g.name]));
  const short = q !== "" && by !== "uniqueid" && q.length < 2;

  let players: SearchHit[] = [];
  let clans: ClanHit[] = [];
  if (q && !short) {
    if (by === "clans") clans = await searchClans(q, game);
    else players = await searchPlayers(q, by, game);
  }
  // Results come in the order of the search; the heads sort them. The
  // ranking sorts by its name.
  const playerValues = {
    order: () => 0,
    name: (p: SearchHit) => p.name,
    game: (p: SearchHit) => gameName.get(p.game) ?? p.game,
    points: (p: SearchHit) => Number(p.skill),
    kills: (p: SearchHit) => Number(p.kills),
    kpd: (p: SearchHit) => kpd(Number(p.kills), Number(p.deaths)),
  };
  const clanValues = {
    order: () => 0,
    clan: (c: ClanHit) => c.tag || c.name,
    game: (c: ClanHit) => gameName.get(c.game) ?? c.game,
    members: (c: ClanHit) => Number(c.members),
    points: (c: ClanHit) => (c.skill === null ? null : Number(c.skill)),
  };
  const playerOrder = sortState(sp, playerValues, "order");
  const clanOrder = sortState(sp, clanValues, "order");
  players = sortRows(players, playerValues, playerOrder.sort, playerOrder.asc);
  clans = sortRows(clans, clanValues, clanOrder.sort, clanOrder.asc);
  const keep = { q, st: by !== "names" ? by : undefined, game: game || undefined };
  const pth = sortHeads(playerOrder, "/search", { ...keep, ...playerOrder.keep });
  const cth = sortHeads(clanOrder, "/search", { ...keep, ...clanOrder.keep });
  const found = players.length + clans.length;
  const bots = await unlinkedBots(players.map((p) => Number(p.playerId)));
  const labels: Record<SearchIn, string> = { names: t.searchNames, uniqueid: t.searchSteam, clans: t.searchClans };

  return (
    <>
      <Section title={t.searchTitle}>
        <Form action="/search" className="search-form" role="search">
          <SortInputs keep={by === "clans" ? clanOrder.keep : playerOrder.keep} />
          <table className="stats">
            <tbody>
              <tr>
                <td className="stats-key">
                  <label htmlFor="search-q">{t.searchFor}</label>
                </td>
                <td>
                  <input {...noAutofill} id="search-q" type="search" name="q" defaultValue={q} maxLength={64} autoFocus={!q} />
                </td>
              </tr>
              <tr>
                <td className="stats-key">
                  <label htmlFor="search-st">{t.searchIn}</label>
                </td>
                <td>
                  <select {...noAutofill} id="search-st" name="st" defaultValue={by}>
                    {SEARCH_IN.map((s) => (
                      <option key={s} value={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
              <tr>
                <td className="stats-key">
                  <label htmlFor="search-game">{t.ranking}</label>
                </td>
                <td>
                  <select {...noAutofill} id="search-game" name="game" defaultValue={game}>
                    <option value="">{t.searchAllRankings}</option>
                    {games.map((g) => (
                      <option key={g.code} value={g.code}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="center">
                  <button type="submit" className="button">
                    {t.search}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </Form>
        {by === "uniqueid" ? <p className="muted">{t.searchSteamHint}</p> : null}
      </Section>

      {q ? (
        <Section title={`${labels[by]}: „${q}“`}>
          {short ? (
            <Empty>{t.searchShort}</Empty>
          ) : !found ? (
            <Empty>{t.noResults}</Empty>
          ) : by === "clans" ? (
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    {cth(t.clan, "clan", "")}
                    {cth(t.ranking, "game", "")}
                    {cth(t.members, "members")}
                    {cth(t.points, "points")}
                  </tr>
                </thead>
                <tbody>
                  {clans.map((c) => (
                    <tr key={c.clanId}>
                      <td>
                        <Link prefetch={false} href={`/${c.game}/clans/${c.clanId}`}>
                          {c.tag ? <b>{c.tag}</b> : null} {c.name}
                        </Link>
                      </td>
                      <td>
                        <Link prefetch={false} href={`/${c.game}`}>{gameName.get(c.game) ?? c.game}</Link>
                      </td>
                      <td className="num">{fmtNum(Number(c.members), lang)}</td>
                      <td className="num">{c.skill === null ? "–" : fmtNum(Number(c.skill), lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          ) : (
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    {pth(t.name, "name", "")}
                    {pth(t.ranking, "game", "")}
                    {pth(t.points, "points")}
                    {pth(t.kills, "kills", "num hide-sm")}
                    {pth(t.kpd, "kpd", "num hide-sm")}
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={`${p.game}-${p.playerId}`}>
                      <td>
                        <PlayerLink game={p.game} id={Number(p.playerId)} name={p.name} flag={p.flag ? { flag: p.flag, country: p.country ?? "" } : null} plain={bots.has(Number(p.playerId))} />
                        {p.alias ? (
                          <span className="muted small">
                            {" "}
                            ({t.searchUsedName} {p.alias})
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <Link prefetch={false} href={`/${p.game}/players`}>{gameName.get(p.game) ?? p.game}</Link>
                      </td>
                      <td className="num">{fmtNum(Number(p.skill), lang)}</td>
                      <td className="num hide-sm">{fmtNum(Number(p.kills), lang)}</td>
                      <td className="num hide-sm">{fmtNum(kpd(Number(p.kills), Number(p.deaths)), lang, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          )}
          <p className="muted">
            {found >= LIMIT ? `${fill(t.searchMore, { n: LIMIT })} ` : ""}
            {by === "clans" ? "" : t.searchHidden}
          </p>
        </Section>
      ) : null}
    </>
  );
}

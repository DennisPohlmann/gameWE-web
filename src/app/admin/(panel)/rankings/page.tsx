import Link from "next/link";
import { Icon } from "@/components/admin/icons";
import { PageHead } from "@/components/admin/page-head";
import { GameTag } from "@/components/ui";
import { adminDict } from "@/lib/admin-i18n";
import { countByRanking, rankingSummaries } from "@/lib/admin-rankings";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { localeOf } from "@/lib/format";
import { getAdminLang } from "@/lib/i18n";
import { GlobalHallCard } from "./global-hall-card";

// All rankings with their game, servers, players and state; one button per
// ranking leads to its page, where it is also edited.
export default async function RankingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAdmin();
  const hof = (await searchParams).hof;
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const u = a.ui;
  const isAdmin = user.acclevel >= LEVEL_ADMIN;
  const nf = (n: number) => n.toLocaleString(localeOf(lang));
  const [all, players] = await Promise.all([rankingSummaries(), countByRanking("hlstats_Players", "game")]);
  // Rankings with servers first, then the templates, each in display order.
  const rankings = [...all.filter((r) => r.servers > 0), ...all.filter((r) => r.servers === 0)];
  const state = (r: (typeof rankings)[number]) =>
    r.hidden ? (
      <span className="pill">{u.stHiddenRanking}</span>
    ) : r.servers > 0 ? (
      <span className="pill ok">
        <span className="dot" />
        {u.stActive}
      </span>
    ) : (
      <span className="pill">{u.stTemplate}</span>
    );
  return (
    <>
      <PageHead
        crumbs={[[u.areaRankings]]}
        title={u.manageRankings}
        intro={u.rankingsIntro}
        actions={
          isAdmin ? (
            <Link className="button primary" href="/admin/games/new">
              <Icon name="plus" />
              {u.newRanking}
            </Link>
          ) : null
        }
      />
      <section className="card">
        <table className="cards">
          <thead>
            <tr>
              <th>{u.colRanking}</th>
              <th>{u.colGame}</th>
              <th className="num">{u.colServers}</th>
              <th className="num">{u.colPlayers}</th>
              <th>{u.colStatus}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rankings.map((r) => (
              <tr key={r.code}>
                <td className="main">
                  <Link className="name" href={`/admin/rankings/${encodeURIComponent(r.code)}`}>
                    {r.name}
                  </Link>{" "}
                  <span className="subt">{r.code}</span>
                </td>
                <td>{r.base ? <GameTag realgame={r.base} long /> : <span className="pill warn">{a.gameUnset}</span>}</td>
                <td className="num" data-l={`${u.colServers}:`}>
                  {nf(r.servers)}
                </td>
                <td className="num" data-l={`${u.colPlayers}:`}>
                  {nf(players.get(r.code) ?? 0)}
                </td>
                <td>{state(r)}</td>
                <td className="end num">
                  <Link className="button small" href={`/admin/rankings/${encodeURIComponent(r.code)}`}>
                    {u.manage}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {isAdmin ? <GlobalHallCard lang={lang} status={hof} rankings={rankings.filter((r) => r.servers > 0)} /> : null}
    </>
  );
}

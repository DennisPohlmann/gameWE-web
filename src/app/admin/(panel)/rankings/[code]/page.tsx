import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon, type IconName } from "@/components/admin/icons";
import { PageHead } from "@/components/admin/page-head";
import { GameTag } from "@/components/ui";
import { entities } from "@/lib/admin-entities";
import { adminDict } from "@/lib/admin-i18n";
import { countByRanking, rankingSummaries } from "@/lib/admin-rankings";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { basePath } from "@/lib/base-path";
import { adminQuery } from "@/lib/db";
import { localeOf } from "@/lib/format";
import { gameKind } from "@/lib/games";
import { getAdminLang } from "@/lib/i18n";

// The lists of a ranking with their table and ranking column (constants).
const LISTS: [string, IconName, string, string][] = [
  ["players", "players", "hlstats_Players", "game"],
  ["clans", "shield", "hlstats_Clans", "game"],
  ["weapons", "weapon", "hlstats_Weapons", "game"],
  ["actions", "bolt", "hlstats_Actions", "game"],
  ["teams", "flag", "hlstats_Teams", "game"],
  ["roles", "mask", "hlstats_Roles", "game"],
  ["awards", "award", "hlstats_Awards", "game"],
  ["ranks", "star", "hlstats_Definition_Ranks_Ribbons", "game_code"],
];

// One ranking: its servers, how many players, clans and definitions it has,
// and the ways to edit, reset or view it.
export default async function RankingPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireAdmin();
  const code = decodeURIComponent((await params).code);
  const rankings = await rankingSummaries();
  const r = rankings.find((x) => x.code === code);
  if (!r) notFound();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const u = a.ui;
  const isAdmin = user.acclevel >= LEVEL_ADMIN;
  const nf = (n: number) => n.toLocaleString(localeOf(lang));
  const q = `?game=${encodeURIComponent(r.code)}`;
  // Server addresses and RCON-related settings are for level 100 only (as the
  // server list itself).
  const [servers, ...counts] = await Promise.all([
    !isAdmin
      ? Promise.resolve([])
      : adminQuery<{
          serverId: number;
          name: string;
          address: string;
          port: number;
          publicaddress: string | null;
          act_map: string | null;
          act_players: number;
          max_players: number;
        }>(
          `SELECT serverId, name, address, port, publicaddress, act_map, act_players, max_players FROM hlstats_Servers WHERE TRIM(game) = ? ORDER BY display_id, serverId`,
          [r.code],
        ),
    ...LISTS.map(([, , table, col]) =>
      countByRanking(table, col, table === "hlstats_Definition_Ranks_Ribbons" ? "definition_type = 'ranks' AND restriction_type = 'kills'" : "").then(
        (m) => m.get(r.code) ?? 0,
      ),
    ),
  ]);
  const label = (key: string) => entities.find((e) => e.key === key)?.label[lang] ?? key;
  const kind = gameKind(r.base);

  return (
    <>
      <PageHead
        crumbs={[[u.areaRankings, "/admin/rankings"], [r.name]]}
        badge={<span className="adm-gtag">{kind?.short.replace(/\s+/g, "").slice(0, 5) ?? r.code.slice(0, 4).toUpperCase()}</span>}
        title={r.name}
        intro={
          <>
            {r.base ? <GameTag realgame={r.base} long /> : <span className="pill warn">{a.gameUnset}</span>} · <code>{r.code}</code> · {nf(r.servers)}{" "}
            {u.colServers} · {nf(counts[0])} {u.colPlayers}{" "}
            {r.hidden ? (
              <span className="pill">{u.stHiddenRanking}</span>
            ) : r.servers ? (
              <span className="pill ok">
                <span className="dot" />
                {u.stActive}
              </span>
            ) : (
              <span className="pill">{u.stTemplate}</span>
            )}
          </>
        }
        actions={
          <>
            <a className="button" href={`${basePath}/${encodeURIComponent(r.code)}`}>
              <Icon name="external" />
              {u.viewPublic}
            </a>
            {isAdmin ? (
              <Link className="button primary" href={`/admin/games/${r.id}`}>
                <Icon name="edit" />
                {u.editRanking}
              </Link>
            ) : null}
          </>
        }
      />
      <div className={isAdmin ? "grid two" : "grid"}>
        {isAdmin ? (
          <section className="card">
            <header>
              <h2>{u.serversHere}</h2>
              {isAdmin ? (
                <Link className="more" href={`/admin/games/${r.id}#servers`}>
                  {u.assignServers}
                </Link>
              ) : null}
            </header>
            {servers.length ? (
              <table className="cards">
                <thead>
                  <tr>
                    <th>{label("servers")}</th>
                    <th>{u.colAddress}</th>
                    <th>{u.colMap}</th>
                    <th className="num">{u.colNow}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {servers.map((s) => (
                    <tr key={s.serverId}>
                      <td className="main">
                        <span className="name">{s.name || `${s.address}:${s.port}`}</span>
                      </td>
                      <td className="mono">{s.publicaddress || `${s.address}:${s.port}`}</td>
                      <td>{s.act_map || "–"}</td>
                      <td className="num">
                        {s.act_players > 0 ? (
                          <span className="pill ok">
                            {nf(s.act_players)} / {nf(s.max_players)}
                          </span>
                        ) : (
                          <span className="pill">0 / {nf(s.max_players)}</span>
                        )}
                      </td>
                      <td className="end num">
                        {isAdmin ? (
                          <Link className="button small" href={`/admin/servers/${s.serverId}?returnTo=${encodeURIComponent(`/admin/servers${q}`)}`}>
                            {a.edit}
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty">{a.rankingNoServers}</p>
            )}
          </section>
        ) : null}
        <section className="card">
          <header>
            <h2>{u.definitionsFrom}</h2>
          </header>
          <ul className="todo">
            {LISTS.map(([key, icon], i) => (
              <li key={key}>
                <Link className="todo-link" href={`/admin/${key}${q}`}>
                  <span className="ic">
                    <Icon name={icon} />
                  </span>
                  <span>
                    <b>{label(key)}</b>
                    {nf(counts[i])}
                  </span>
                </Link>
              </li>
            ))}
            {isAdmin ? (
              <li>
                <Link className="todo-link" href={`/admin/reset${q}`}>
                  <span className="ic bad">
                    <Icon name="reset" />
                  </span>
                  <span>
                    <b>{u.resetRanking}</b>
                  </span>
                </Link>
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </>
  );
}

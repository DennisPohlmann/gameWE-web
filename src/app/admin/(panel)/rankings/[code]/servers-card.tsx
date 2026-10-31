import Link from "next/link";
import { assignServersAction, moveServerAction } from "../../../actions";
import { Icon } from "@/components/admin/icons";
import { GameIcon } from "@/components/ui";
import { optionList } from "@/lib/admin-data";
import { entities } from "@/lib/admin-entities";
import { adminDict } from "@/lib/admin-i18n";
import { allServers, rankingBaseGames } from "@/lib/admin-rankings";
import { noAutofill } from "@/lib/autofill";
import { adminQuery } from "@/lib/db";
import { localeOf } from "@/lib/format";
import { gameKind, sameBaseGame } from "@/lib/games";
import { fill } from "@/lib/i18n";
import { newServerHref } from "@/lib/ranking-preset";
import { serverRankingOptions } from "@/lib/server-rankings";

// The servers of one ranking (level 100, as the server list): live state,
// edit, move into another ranking of the same game (not a template), and the
// servers of other rankings to move in.
export async function ServersCard({ id, code, lang, sp }: { id: number; code: string; lang: "de" | "en"; sp: Record<string, string | undefined> }) {
  const a = adminDict(lang);
  const u = a.ui;
  const nf = (n: number) => n.toLocaleString(localeOf(lang));
  const [mine, servers, games, bases] = await Promise.all([
    adminQuery<{
      serverId: number;
      name: string;
      address: string;
      port: number;
      publicaddress: string | null;
      act_map: string | null;
      act_players: number;
      max_players: number;
      display_id: number;
    }>(
      `SELECT serverId, name, address, port, publicaddress, act_map, act_players, max_players, display_id FROM hlstats_Servers WHERE TRIM(game) = ? ORDER BY display_id, serverId`,
      [code],
    ),
    allServers(),
    optionList("games"),
    rankingBaseGames(),
  ]);
  // Servers only move between rankings of the same base game.
  const base = bases.get(code) ?? null;
  const fits = (c: string) => sameBaseGame(bases.get(c) ?? null, base);
  const gameName = (c: string) => gameKind(bases.get(c))?.short ?? "?";
  // No templates (rankings without servers) to move a server into.
  const targets = serverRankingOptions(games, new Set(servers.map((s) => s.game))).filter(([c]) => c !== code && fits(c));
  // Only servers of this ranking's game can be moved in (a Counter-Strike:
  // Source ranking only takes Counter-Strike: Source servers); the others
  // are not listed, the save refuses them too (admin-ops.ts).
  const others = servers.filter((s) => s.game !== code && fits(s.game));
  const otherGames = servers.some((s) => s.game !== code && !fits(s.game));
  const sameGameHint = base ? fill(a.rankingSameGameOnly, { g: gameKind(base)?.name ?? base }) : a.rankingGameFirst;
  const label = entities.find((e) => e.key === "servers")?.label[lang] ?? "Server";
  const returnTo = encodeURIComponent(`/admin/servers?game=${encodeURIComponent(code)}`);
  const error = sp.serr === "mismatch" ? a.gameMismatch : sp.serr === "db" ? fill(a.dbWriteError, { msg: sp.msg ?? "" }) : null;
  return (
    <section className="card" id="servers">
      <header>
        <h2>
          {u.serversHere} <span className="pill">{nf(mine.length)}</span>
        </h2>
        <Link className="more" href={`/admin/servers?game=${encodeURIComponent(code)}`}>
          {u.serverList}
        </Link>
        <Link className="button small primary" href={newServerHref(code)}>
          <Icon name="plus" />
          {u.addServer}
        </Link>
      </header>
      {sp.saved === "server" ? <p className="notice">{u.serverAdded}</p> : null}
      {sp.saved === "servers" ? <p className="notice">{u.serversSaved}</p> : null}
      {error ? <p className="notice error">{error}</p> : null}
      {mine.length ? (
        <>
          <table className="cards stack">
            <thead>
              <tr>
                <th className="num ord">{u.colOrder}</th>
                <th>{label}</th>
                <th>{u.colAddress}</th>
                <th>{u.colMap}</th>
                <th className="num">{u.colNow}</th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {mine.map((s) => (
                <tr key={s.serverId}>
                  <td className="num ord" data-l={`${u.colOrder}:`}>
                    {nf(Number(s.display_id ?? 0))}
                  </td>
                  <td className="main wrap-cell">
                    <Link className="name" href={`/admin/servers/${s.serverId}?returnTo=${returnTo}`}>
                      <GameIcon realgame={base} />
                      {s.name || `${s.address}:${s.port}`}
                    </Link>
                  </td>
                  <td className="mono">{s.publicaddress || `${s.address}:${s.port}`}</td>
                  <td>{s.act_map || "–"}</td>
                  <td className="num">
                    <span className={s.act_players > 0 ? "pill ok" : "pill"}>
                      {nf(s.act_players)} / {nf(s.max_players)}
                    </span>
                  </td>
                  <td className="act">
                    {targets.length ? (
                      <form action={moveServerAction} className="inline-form">
                        <input type="hidden" name="__id" value={String(id)} />
                        <input type="hidden" name="server" value={s.serverId} />
                        <select {...noAutofill} name="target" aria-label={a.rankingRemoveTo} defaultValue="">
                          <option value="" disabled>
                            {a.rankingRemoveTo} …
                          </option>
                          {targets.map(([v, l]) => (
                            <option key={v} value={v}>
                              {l}
                            </option>
                          ))}
                        </select>{" "}
                        <button type="submit" className="button small">
                          {a.rankingRemove}
                        </button>
                      </form>
                    ) : null}
                  </td>
                  <td className="end num">
                    <Link className="button small" href={`/admin/servers/${s.serverId}?returnTo=${returnTo}`}>
                      {a.edit}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {targets.length ? (
            <p>
              <small className="muted">{a.rankingRemoveHint}</small>
            </p>
          ) : null}
        </>
      ) : (
        <p className="empty">{a.rankingNoServers}</p>
      )}
      {others.length || otherGames ? (
        <details className="assign-servers" open={!mine.length}>
          <summary>{a.rankingAddServers.replace(/:$/, "")}</summary>
          {others.length ? (
            <form action={assignServersAction} className="form">
              <input type="hidden" name="__id" value={String(id)} />
              {others.map((s) => (
                <label key={s.serverId} className="check">
                  <input type="checkbox" name="server" value={s.serverId} /> <GameIcon realgame={bases.get(s.game)} />
                  {s.name || `${s.address}:${s.port}`}{" "}
                  <span className="muted">
                    ({a.rankingNow}: {s.game}, {gameName(s.game)})
                  </span>
                </label>
              ))}
              {otherGames ? <small className="muted">{sameGameHint}</small> : null}
              <small className="muted">{a.rankingMoveHint}</small>
              <button type="submit" className="button">
                {a.rankingAssign}
              </button>
            </form>
          ) : (
            <p className="empty">
              {a.rankingNoFittingServers} {sameGameHint}
            </p>
          )}
        </details>
      ) : null}
    </section>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { botProfiles, type LivePlayer, type Server } from "@/lib/data";
import { countryName, fmtDuration, fmtNum, fmtPct, nowUnix, ratio } from "@/lib/format";
import { baseGameOf, gameKind } from "@/lib/games";
import type { Dict, Lang } from "@/lib/i18n";
import { playerCount } from "@/lib/player-count";
import { LINUX_SVG, VAC_SVG, WINDOWS_SVG } from "@/lib/server-icons";
import { PlayerCount } from "./player-count";
import { Flag } from "./ui";

// Server rows as on gameME: name, game, address (steam://connect), map, map
// time, players. The game is the ranking's base game ("Counter-Strike:
// Source"), else the ranking's name. `head` is an optional first header row spanning the table. The
// flag of the server's country stands before its name. `details` adds the
// server version with an OS icon and the VAC state as the last columns (the
// ranking's start page only).
export function ServerTable({ game, servers, head, details, t, lang }: { game: string; servers: Server[]; head?: ReactNode; details?: boolean; t: Dict; lang: Lang }) {
  const now = nowUnix();
  const w = details ? { server: "36%", game: "12%", address: "15%", map: "8%", time: "7%", players: "8%" } : { server: "46%", game: "14%", address: "16%", map: "8%", time: "8%", players: "8%" };
  return (
    <div className="table-wrap">
      <table>
        <thead>
          {head ? (
            <tr>
              <th colSpan={details ? 8 : 6} className="wrap-cell">{head}</th>
            </tr>
          ) : null}
          <tr>
            <th style={{ width: w.server }}>{t.server}</th>
            <th className="hide-sm" style={{ width: w.game }}>
              {t.baseGame}
            </th>
            <th className="hide-sm" style={{ width: w.address }}>
              {t.address}
            </th>
            <th style={{ width: w.map }}>
              {t.map}
            </th>
            <th className="num hide-sm" style={{ width: w.time }}>
              {t.time}
            </th>
            <th className="num" style={{ width: w.players }}>
              {t.players}
            </th>
            {details ? (
              <>
                <th className="hide-sm" style={{ width: "9%" }}>
                  {t.serverVersion}
                </th>
                <th className="center hide-sm" style={{ width: "5%" }}>
                  {t.vac}
                </th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {servers.map((s) => {
            const addr = s.publicaddress || `${s.address}:${s.port}`;
            const cls = !s.act_players ? "srv-empty" : s.max_players && s.act_players >= s.max_players ? "srv-full" : "srv-nempty";
            return (
              <tr key={s.serverId} className="server-line">
                <td className="wrap-cell">
                  <ServerFlag code={s.country_code} lang={lang} />
                  <Link className="srv" href={`/${game}/servers/${s.serverId}`}>
                    {s.name || addr}
                  </Link>
                </td>
                <td className="hide-sm">{gameKind(baseGameOf(s.game, s.realgame))?.name || s.game_name || "-"}</td>
                <td className="hide-sm">
                  <a href={`steam://connect/${addr}/`}>{addr}</a>
                </td>
                <td>{s.act_map || "-"}</td>
                <td className="num hide-sm">{s.map_started ? fmtDuration(now - s.map_started) : "-"}</td>
                <td className="num">
                  <span className={cls}>
                    <PlayerCount count={playerCount(s.act_players, s.bots, s.max_players)} lang={lang} botsLabel={t.bots} />
                  </span>
                </td>
                {details ? (
                  <>
                    <td className="hide-sm nowrap">
                      <ServerVersion version={s.server_version} os={s.server_os} />
                    </td>
                    <td className="center hide-sm">
                      <VacState vac={s.server_vac} t={t} />
                    </td>
                  </>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Version number, a space, the OS icon ("Linux" / "Windows" as title).
// The icons are constant markup of server-icons.ts.
function ServerVersion({ version, os }: { version: string; os: string }) {
  const icon = os === "linux" ? { svg: LINUX_SVG, name: "Linux" } : os === "windows" ? { svg: WINDOWS_SVG, name: "Windows" } : null;
  if (!version && !icon && os !== "mac") return <>-</>;
  return (
    <>
      {version || "-"}{" "}
      {icon ? (
        <span className="os-mark" title={icon.name} role="img" aria-label={icon.name} dangerouslySetInnerHTML={{ __html: icon.svg }} />
      ) : os === "mac" ? (
        <span className="os-mark muted" title="macOS">
          macOS
        </span>
      ) : null}
    </>
  );
}

// The VAC shield when the server is VAC-secured; a muted "-" when it is not,
// "-" when unknown.
export function VacState({ vac, t }: { vac: string; t: Dict }) {
  if (vac === "secure")
    return <span className="vac-mark" title={t.vacSecure} role="img" aria-label={t.vacSecure} dangerouslySetInnerHTML={{ __html: VAC_SVG }} />;
  if (vac === "insecure")
    return (
      <span className="muted" title={t.vacInsecure}>
        -
      </span>
    );
  return <>-</>;
}

// Flag of a server's country (hlstats_Servers.country_code) with the country
// name as title; the neutral placeholder for an empty or unknown code.
export function ServerFlag({ code, lang }: { code: string | null | undefined; lang: Lang }) {
  return (
    <>
      <Flag code={code} title={countryName(code, lang) || undefined} />{" "}
    </>
  );
}

// Players on one server, coloured by team like gameME's live stats: the first
// team blue, the second red, everyone else (spectators, unassigned) grey.
export async function LiveTable({ game, players, t, lang }: { game: string; players: LivePlayer[]; t: Dict; lang: Lang }) {
  const botLinks = await botProfiles();
  const teams = new Map<string, LivePlayer[]>();
  for (const p of players) {
    const k = p.team || "";
    teams.set(k, [...(teams.get(k) ?? []), p]);
  }
  const playing = [...teams.keys()].filter((k) => k && !/^(spectator|unassigned)$/i.test(k));
  const rowClass = (team: string) => (team === playing[0] ? "team-a" : team === playing[1] ? "team-b" : "team-x");
  const ordered = [...playing, ...[...teams.keys()].filter((k) => !playing.includes(k))];
  const now = nowUnix();
  let n = 0;
  return (
    <div className="table-wrap">
      <table className="player-livestats">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>{t.player}</th>
            <th className="center" colSpan={3}>
              {t.frags}
            </th>
            <th className="num">{t.hs}</th>
            <th className="num">{t.hpk}</th>
            <th className="num hide-sm">{t.rounds}</th>
            <th className="num hide-sm">{t.acc}</th>
            <th className="num hide-sm">{t.latency}</th>
            <th className="num hide-sm">{t.time}</th>
            <th className="num">+/-</th>
            <th className="num">{t.skill}</th>
            <th className="num hide-sm">{t.position}</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((team) => {
            const list = teams.get(team) ?? [];
            const sum = list.reduce((a, p) => ({ kills: a.kills + p.kills, deaths: a.deaths + p.deaths }), { kills: 0, deaths: 0 });
            const cls = rowClass(team);
            return [
              ...list.map((p) => (
                <tr key={p.player_id} className={cls}>
                  <td className="rank num">{++n}</td>
                  <td className="wrap-cell">
                    {/* Bots get their tag where players have the flag, so the names line up. */}
                    {p.is_bot ? <Flag code="bot" /> : <Flag code={p.flag} title={p.country} />}{" "}
                    {p.is_bot && !botLinks ? (
                      <span className={p.is_dead ? "dead" : undefined}>{p.name || `#${p.player_id}`}</span>
                    ) : (
                      <Link href={`/${game}/players/${p.player_id}`} className={p.is_dead ? "dead" : undefined}>
                        {p.name || `#${p.player_id}`}
                      </Link>
                    )}
                  </td>
                  <td className="right frag">{p.kills}</td>
                  <td className="center frag">:</td>
                  <td className="frag">{p.deaths}</td>
                  <td className="num">{p.headshots}</td>
                  <td className="num">{p.kills ? fmtPct(ratio(p.headshots, p.kills), lang) : "-"}</td>
                  <td className="num hide-sm">{p.rounds}</td>
                  <td className="num hide-sm">{p.shots ? fmtPct(ratio(p.hits, p.shots), lang) : "-"}</td>
                  <td className="num hide-sm">{p.ping || "-"}</td>
                  <td className="num hide-sm">{p.connected ? fmtDuration(now - p.connected) : "-"}</td>
                  <td className="num">
                    {p.skill_change > 0 ? "+" : ""}
                    {p.skill_change ? fmtNum(p.skill_change, lang) : "-"}
                  </td>
                  <td className="num">{p.skill ? fmtNum(p.skill, lang) : "-"}</td>
                  <td className="num hide-sm">{p.position ? fmtNum(p.position, lang) : "-"}</td>
                </tr>
              )),
              <tr key={`sum-${team}`} className={`${cls} team-sum`}>
                <td />
                <td>
                  {team || "-"} ({list.length})
                </td>
                <td className="right frag">{sum.kills}</td>
                <td className="center frag">:</td>
                <td className="frag">{sum.deaths}</td>
                <td colSpan={9} />
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

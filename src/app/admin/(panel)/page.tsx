import Link from "next/link";
import { Icon } from "@/components/admin/icons";
import { PageHead } from "@/components/admin/page-head";
import { GameTag } from "@/components/ui";
import { adminDict } from "@/lib/admin-i18n";
import { countByRanking, rankingSummaries } from "@/lib/admin-rankings";
import { LEVEL_ADMIN, adminSecret, requireAdmin } from "@/lib/auth";
import { adminQuery } from "@/lib/db";
import { localeOf } from "@/lib/format";
import { fill, getAdminLang } from "@/lib/i18n";
import { readSecret } from "@/lib/totp";

// The collector writes gamewe_heartbeat every minute; older than this it
// counts as silent.
const HEARTBEAT_STALE = 5 * 60;

// Admin overview: key figures, the rankings with their state, what needs
// attention and quick links into both areas.
export default async function AdminHome() {
  const user = await requireAdmin();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const u = a.ui;
  const isAdmin = user.acclevel >= LEVEL_ADMIN;
  const nf = (n: number) => n.toLocaleString(localeOf(lang));
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const secret = adminSecret();
  const [rankings, players, [totals], [servers], beat, totp] = await Promise.all([
    rankingSummaries(),
    countByRanking("hlstats_Players", "game"),
    adminQuery<{ n: number | string; hidden: number | string; today: number | string }>(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN hideranking <> 0 THEN 1 ELSE 0 END) AS hidden, SUM(CASE WHEN last_event >= ? THEN 1 ELSE 0 END) AS today FROM hlstats_Players`,
      [Math.floor(midnight.getTime() / 1000)],
    ),
    adminQuery<{ n: number | string; busy: number | string }>(
      `SELECT COUNT(*) AS n, SUM(CASE WHEN act_players > 0 THEN 1 ELSE 0 END) AS busy FROM hlstats_Servers`,
    ),
    adminQuery<{ value: string }>(`SELECT value FROM hlstats_Options WHERE keyname = 'gamewe_heartbeat'`).catch(() => []),
    secret ? readSecret(user.username, secret).catch(() => null) : Promise.resolve(undefined),
  ]);
  const active = rankings.filter((r) => r.servers > 0 || (players.get(r.code) ?? 0) > 0);
  const templates = rankings.filter((r) => !active.includes(r));
  const beatAt = Number(beat[0]?.value ?? 0);
  const now = Math.floor(Date.now() / 1000);
  const beatOk = beatAt > 0 && now - beatAt < HEARTBEAT_STALE;
  const since = beatAt > 0 ? new Date(beatAt * 1000).toLocaleString(localeOf(lang), { dateStyle: "short", timeStyle: "short" }) : "?";
  const noGame = active.filter((r) => !r.base);

  const todo: { tone: "bad" | "warn" | "acc"; icon: Parameters<typeof Icon>[0]["name"]; title: string; text: string; href: string; link: string }[] = [];
  if (totp === null)
    todo.push({ tone: "bad", icon: "lock", title: fill(u.att2fa, { u: user.username }), text: u.att2faText, href: "/admin/account", link: u.att2faLink });
  if (!beatOk)
    todo.push({
      tone: "warn",
      icon: "warn",
      title: beatAt ? fill(u.attCollector, { t: since }) : u.attCollectorNever,
      text: u.attCollectorText,
      href: "/admin/settings/capture",
      link: u.navCollector,
    });
  for (const r of noGame) {
    todo.push({
      tone: "warn",
      icon: "warn",
      title: fill(u.attNoGame, { list: r.name }),
      text: u.attNoGameText,
      href: isAdmin ? `/admin/games/${r.id}` : `/admin/rankings/${encodeURIComponent(r.code)}`,
      link: u.attNoGameLink,
    });
  }
  if (isAdmin && Number(servers?.n ?? 0) === 0)
    todo.push({ tone: "acc", icon: "server", title: u.attNoServers, text: u.attNoServersText, href: "/admin/servers/new", link: u.attNoServersLink });

  return (
    <>
      <PageHead title={u.areaHome} intro={u.homeIntro} />
      <div className="grid kpis">
        <div className="card kpi">
          <div className="k">{u.kpiRankings}</div>
          <div className="v">{nf(active.length)}</div>
          <div className="s">{fill(u.kpiRankingsSub, { n: nf(rankings.length) })}</div>
        </div>
        <div className="card kpi">
          <div className="k">{u.kpiServers}</div>
          <div className="v">{nf(Number(servers?.n ?? 0))}</div>
          <div className="s">
            {fill(u.kpiServersSub, { n: nf(Number(servers?.busy ?? 0)) })}{" "}
            <span className={`pill ${beatOk ? "ok" : beatAt ? "warn" : ""}`} title={beatAt ? since : undefined}>
              <span className="dot" />
              {beatOk ? u.collectorOk : beatAt ? fill(u.collectorStale, { t: since }) : u.collectorUnknown}
            </span>
          </div>
        </div>
        <div className="card kpi">
          <div className="k">{u.kpiPlayers}</div>
          <div className="v">{nf(Number(totals?.n ?? 0))}</div>
          <div className="s">{fill(u.kpiPlayersSub, { n: nf(Number(totals?.hidden ?? 0)) })}</div>
        </div>
        <div className="card kpi">
          <div className="k">{u.kpiToday}</div>
          <div className="v">{nf(Number(totals?.today ?? 0))}</div>
          <div className="s">{u.kpiTodaySub}</div>
        </div>
      </div>
      <div className="grid two">
        <section className="card">
          <header>
            <h2>{u.areaRankings}</h2>
            <Link className="more" href="/admin/rankings">
              {u.manageAll}
            </Link>
          </header>
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
              {active.map((r) => (
                <tr key={r.code}>
                  <td className="main">
                    <span className="name">{r.name}</span> <span className="subt">{r.code}</span>
                  </td>
                  <td>{r.base ? <GameTag realgame={r.base} long /> : <span className="pill warn">{a.gameUnset}</span>}</td>
                  <td className="num" data-l={`${u.colServers}:`}>
                    {nf(r.servers)}
                  </td>
                  <td className="num" data-l={`${u.colPlayers}:`}>
                    {nf(players.get(r.code) ?? 0)}
                  </td>
                  <td>
                    {r.hidden ? (
                      <span className="pill">{u.stHiddenRanking}</span>
                    ) : (
                      <span className="pill ok">
                        <span className="dot" />
                        {u.stActive}
                      </span>
                    )}
                  </td>
                  <td className="end num">
                    <Link className="button small" href={`/admin/rankings/${encodeURIComponent(r.code)}`}>
                      {u.open}
                    </Link>
                  </td>
                </tr>
              ))}
              {templates.length ? (
                <tr>
                  <td className="main">
                    <span className="name">{fill(u.templates, { n: nf(templates.length) })}</span>{" "}
                    <span className="subt">
                      {templates
                        .slice(0, 4)
                        .map((r) => r.code)
                        .join(", ")}
                      {templates.length > 4 ? " …" : ""}
                    </span>
                  </td>
                  <td className="muted">{u.templatesSub}</td>
                  <td className="num" />
                  <td className="num" />
                  <td>
                    <span className="pill">{u.stTemplate}</span>
                  </td>
                  <td className="end num">
                    <Link className="button small" href="/admin/rankings">
                      {u.show}
                    </Link>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>
        <div className="grid" style={{ margin: 0 }}>
          <section className="card">
            <header>
              <h2>{u.attention}</h2>
              {todo.length ? <span className="pill warn">{todo.length}</span> : null}
            </header>
            <ul className="todo">
              {todo.length ? (
                todo.map((x) => (
                  <li key={x.title}>
                    <Link className="todo-link" href={x.href}>
                      <span className={`ic ${x.tone}`}>
                        <Icon name={x.icon} />
                      </span>
                      <span>
                        <b>{x.title}</b>
                        {x.text} <span style={{ color: "var(--accent-text)" }}>{x.link} →</span>
                      </span>
                    </Link>
                  </li>
                ))
              ) : (
                <li>
                  <span className="ic ok">
                    <Icon name="check" />
                  </span>
                  <span>{u.attNone}</span>
                </li>
              )}
            </ul>
          </section>
          <section className="card">
            <header>
              <h2>{u.quick}</h2>
            </header>
            <div className="grid quick">
              <Link href="/admin/players">
                <Icon name="search" />
                {u.qPlayers}
              </Link>
              {isAdmin ? (
                <Link href="/admin/servers/new">
                  <Icon name="plus" />
                  {u.qServer}
                </Link>
              ) : null}
              <Link href="/admin/settings/design">
                <Icon name="palette" />
                {u.qDesign}
              </Link>
              <Link href="/admin/chat">
                <Icon name="chat" />
                {u.qChat}
              </Link>
            </div>
          </section>
        </div>
      </div>
      <p className="muted small">{a.readOnlyDb}</p>
    </>
  );
}

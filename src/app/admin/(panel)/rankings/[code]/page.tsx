import type { ReactNode } from "react";
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
import { localeOf } from "@/lib/format";
import { gameKind } from "@/lib/games";
import { getAdminLang } from "@/lib/i18n";
import { rankingBlockVac, rankingBots } from "@/lib/admin-ranking-bots";
import { hallSettings } from "@/lib/admin-hall";
import { nextStart } from "@/lib/hall-period";
import { scheduleText } from "@/components/admin/hall-schedule";
import { steamKeyStored } from "@/lib/steam";
import { fill } from "@/lib/i18n";
import { BotsCard } from "./bots-card";
import { HallOfFameCard } from "./hall-of-fame-card";
import { ServersCard } from "./servers-card";
import { SettingsCard } from "./settings-card";
import { VacCard } from "./vac-card";

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

// One ranking, the one place to manage it: what state it is in, its
// settings, servers, values, rules (bots, VAC, scheduled reset) and the
// reset. Level 100 sees and edits everything; lower levels see the state and
// the values.
export default async function RankingPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireAdmin();
  const code = decodeURIComponent((await params).code);
  const sp = await searchParams;
  const rankings = await rankingSummaries();
  const r = rankings.find((x) => x.code === code);
  if (!r) notFound();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const u = a.ui;
  const isAdmin = user.acclevel >= LEVEL_ADMIN;
  const nf = (n: number) => n.toLocaleString(localeOf(lang));
  const q = `?game=${encodeURIComponent(r.code)}`;
  const template = r.servers === 0;
  // The VAC block and whether the collector has a Steam key for it; the bots
  // and the scheduled reset for the summary at the top.
  const [vacBlock, vacKey, bots, hall, ...counts] = await Promise.all([
    rankingBlockVac(r.code),
    steamKeyStored(),
    rankingBots(r.code),
    hallSettings(r.code),
    ...LISTS.map(([, , table, col]) =>
      countByRanking(table, col, table === "hlstats_Definition_Ranks_Ribbons" ? "definition_type = 'ranks' AND restriction_type = 'kills'" : "").then(
        (m) => m.get(r.code) ?? 0,
      ),
    ),
  ]);
  // Servers with players right now (the addresses stay on the servers card).
  const busy = isAdmin
    ? Number((await countByRanking("hlstats_Servers", "game", "act_players > 0")).get(r.code) ?? 0)
    : null;
  const label = (key: string) => entities.find((e) => e.key === key)?.label[lang] ?? key;
  const kind = gameKind(r.base);
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC" });
  const state = r.hidden
    ? { pill: <span className="pill">{u.stHiddenRanking}</span>, sub: u.stHiddenSub }
    : template
      ? { pill: <span className="pill">{u.stTemplate}</span>, sub: a.templateHint }
      : {
          pill: (
            <span className="pill ok">
              <span className="dot" />
              {u.stActive}
            </span>
          ),
          sub: u.stActiveSub,
        };
  // The cards of this page, for the jump links at the top.
  const parts: [string, string][] = [
    ...(isAdmin ? ([["settings", u.settings], ["servers", u.serversHere]] as [string, string][]) : []),
    ["values", u.definitionsFrom],
    ...(isAdmin
      ? ([
          ["bots", u.partBots],
          ["vac", u.partVac],
          ...(template ? [] : [["hall-of-fame", u.kpiReset]]),
          ["maintenance", u.maintenance],
        ] as [string, string][])
      : []),
  ];

  return (
    <>
      <PageHead
        crumbs={[[u.areaRankings, "/admin/rankings"], [r.name]]}
        badge={<span className="adm-gtag">{kind?.short.replace(/\s+/g, "").slice(0, 5) ?? r.code.slice(0, 4).toUpperCase()}</span>}
        title={r.name}
        intro={
          <>
            {r.base ? <GameTag realgame={r.base} long /> : <span className="pill warn">{a.gameUnset}</span>} · <code>{r.code}</code> {state.pill}{" "}
            <span className="pill">{bots.ranked ? u.botsRanked : u.botsNotRanked}</span>
            {vacBlock ? <span className={vacKey ? "pill" : "pill warn"}>{vacKey ? a.vacBlockOn : a.vacBlockNoKey}</span> : null}
          </>
        }
        actions={
          <a className="button" href={`${basePath}/${encodeURIComponent(r.code)}`} target="_blank" rel="noopener">
            <Icon name="external" />
            {u.viewPublic}
          </a>
        }
      />
      <div className="grid kpis">
        <Kpi k={u.colStatus} v={state.pill} s={state.sub} text />
        <Kpi href={isAdmin ? "#servers" : undefined} k={u.kpiServers} v={nf(r.servers)} s={busy !== null ? fill(u.kpiServersSub, { n: nf(busy) }) : null} />
        <Kpi k={u.kpiPlayers} v={nf(counts[0])} s={u.kpiPlayersHere} />
        <Kpi
          href={isAdmin && !template ? "#hall-of-fame" : undefined}
          k={u.kpiReset}
          v={template ? "–" : hall.effective ? scheduleText(lang, hall.effective) : u.kpiResetOff}
          s={
            template
              ? u.kpiResetTemplate
              : hall.effective
                ? `${hall.source === "global" ? u.kpiResetGlobal : u.kpiResetOwn}${hall.last ? ` · ${fill(u.kpiResetNext, { d: date(nextStart(hall.last, hall.effective)) })}` : ""}`
                : u.kpiResetNone
          }
          text
        />
      </div>
      <nav className="page-nav" aria-label={u.onThisPage}>
        {parts.map(([id, l]) => (
          <a key={id} href={`#${id}`}>
            {l}
          </a>
        ))}
      </nav>
      {isAdmin ? <SettingsCard id={r.id} lang={lang} sp={sp} /> : null}
      {isAdmin ? <ServersCard id={r.id} code={r.code} lang={lang} sp={sp} /> : null}
      <section className="card" id="values">
        <header>
          <h2>{u.definitionsFrom}</h2>
        </header>
        <ul className="todo values">
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
        </ul>
      </section>
      {isAdmin ? (
        <>
          <h2 className="group-head">{u.rulesHead}</h2>
          <BotsCard game={r.code} lang={lang} status={sp.bots} changed={sp.n} />
          <VacCard game={r.code} lang={lang} on={vacBlock} keyStored={vacKey} status={sp.vac} />
          {/* A template (no servers) is never reset: no schedule to set. */}
          {!template ? <HallOfFameCard game={r.code} lang={lang} status={sp.hof} /> : null}
          <section className="card" id="maintenance">
            <header>
              <h2>{u.maintenance}</h2>
            </header>
            {template ? (
              <p className="muted">{u.templateMaintenance}</p>
            ) : (
              <div className="body maintenance">
                <p>{u.maintenanceIntro}</p>
                <Link className="button danger" href={`/admin/reset${q}`}>
                  <Icon name="reset" />
                  {u.resetRanking} …
                </Link>
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}

// One figure of the summary at the top; a link to its card when it has one.
function Kpi({ k, v, s, href, text }: { k: string; v: ReactNode; s: ReactNode; href?: string; text?: boolean }) {
  const inner = (
    <>
      <div className="k">{k}</div>
      <div className={text ? "v kpi-text" : "v"}>{v}</div>
      {s ? <div className="s">{s}</div> : null}
    </>
  );
  return href ? (
    <a className="card kpi kpi-link" href={href}>
      {inner}
    </a>
  ) : (
    <div className="card kpi">{inner}</div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { scheduleText } from "@/components/admin/hall-schedule";
import { PageHead } from "@/components/admin/page-head";
import { adminDict } from "@/lib/admin-i18n";
import { jobsOverview, type Job, type ScheduledRanking } from "@/lib/admin-jobs";
import { rankingSummaries } from "@/lib/admin-rankings";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { fmtDateTime, nowUnix } from "@/lib/format";
import { scheduleValue } from "@/lib/hall-period";
import { fill, getAdminLang } from "@/lib/i18n";
import { jobType, shortDuration, type JobPlan, type JobType } from "@/lib/job-plan";
import { jobModeName, type ResetMode } from "@/lib/reset-modes";

// The collector writes gamewe_heartbeat every minute; older than this it
// counts as silent (as on the overview).
const HEARTBEAT_STALE = 5 * 60;

const T = {
  de: {
    title: "Jobs",
    intro: "Was der Collector als Nächstes erledigt, was gerade wartet oder läuft und was er zuletzt gemacht hat.",
    collectorOk: "Collector läuft",
    collectorStale: "Collector still seit {t}",
    collectorNever: "Collector noch nie gesehen",
    collectorDown: "Der Collector läuft gerade nicht. Geplante und wartende Jobs laufen erst, wenn er wieder läuft.",
    next: "Als Nächstes",
    noPlan: "Der Collector meldet die Uhrzeiten seiner täglichen Jobs erst ab Version 0.27.0. Bis dahin fehlen hier die Zeiten der Awards und der inaktiven Spieler.",
    nothingPlanned: "Nichts geplant: Die täglichen Jobs sind aus und kein Ranking hat einen geplanten Reset.",
    colJob: "Job",
    colWhen: "Nächster Lauf",
    colPlan: "Zeitplan",
    colState: "Status",
    awards: "Tägliche Awards",
    awardsSub: "Awards des Vortags für alle Rankings",
    inactive: "Inaktive Spieler verschieben",
    inactiveSub: "Spieler ohne Spiel seit „Inaktiv nach“ Tagen",
    scheduled: "Geplanter Reset",
    daily: "täglich {t}",
    off: "Aus",
    offHint: "aus in der config.yaml ({k})",
    planned: "Geplant",
    overdue: "Überfällig",
    in: "in {d}",
    ago: "vor {d}",
    unknown: "unbekannt",
    queue: "Warteschlange",
    queueEmpty: "Nichts wartet, nichts läuft.",
    queueHint: "Der Collector nimmt die Jobs nacheinander, den ältesten zuerst.",
    history: "Verlauf",
    historyHint: "Die letzten {n} erledigten Jobs; der Collector löscht sie nach 30 Tagen.",
    historyEmpty: "Noch keine Jobs.",
    noTable: "Die Tabelle hlstats_gamewe_jobs fehlt; die Datenbank braucht Collector 0.1.0 oder neuer.",
    colNo: "Nr.",
    colRanking: "Ranking",
    colBy: "Von",
    colAt: "Angelegt",
    colStarted: "Gestartet",
    colTook: "Dauer",
    colResult: "Ergebnis",
    by: "von",
    bySchedule: "Zeitplan",
    anAdmin: "einem Admin",
    status: { pending: "Wartet", running: "Läuft", done: "Erledigt", failed: "Fehlgeschlagen" } as Record<string, string>,
    types: { reset: "Ranking zurücksetzen", "scheduled-reset": "Geplanter Reset", inactive: "Inaktive Spieler verschieben", awards: "Tägliche Awards" } as Record<JobType, string>,
    modes: { "player-stats": "Nur Spielerstatistiken", "all-stats": "Alle Statistiken", all: "Alles, auch die Spieler" } as Record<ResetMode, string>,
    forDay: "für den {d}",
    allRankings: "alle Rankings",
    openRanking: "Öffnen",
    rankingsN: "{n} Rankings",
    console: "Auf der Konsole: gamewe jobs (Liste), gamewe jobs -queue (Warteschlange).",
  },
  en: {
    title: "Jobs",
    intro: "What the collector does next, what is waiting or running right now and what it did last.",
    collectorOk: "Collector running",
    collectorStale: "Collector silent since {t}",
    collectorNever: "Collector never seen",
    collectorDown: "The collector is not running right now. Planned and waiting jobs only run once it runs again.",
    next: "Next up",
    noPlan: "The collector reports the times of its daily jobs from version 0.27.0. Until then the times of the awards and the inactive players are missing here.",
    nothingPlanned: "Nothing planned: the daily jobs are off and no ranking has a scheduled reset.",
    colJob: "Job",
    colWhen: "Next run",
    colPlan: "Schedule",
    colState: "Status",
    awards: "Daily awards",
    awardsSub: "the previous day's awards of all rankings",
    inactive: "Move inactive players",
    inactiveSub: "players who have not played for the “inactive after” days",
    scheduled: "Scheduled reset",
    daily: "daily {t}",
    off: "Off",
    offHint: "off in config.yaml ({k})",
    planned: "Planned",
    overdue: "Overdue",
    in: "in {d}",
    ago: "{d} ago",
    unknown: "unknown",
    queue: "Queue",
    queueEmpty: "Nothing is waiting or running.",
    queueHint: "The collector takes the jobs one after the other, the oldest first.",
    history: "History",
    historyHint: "The last {n} finished jobs; the collector deletes them after 30 days.",
    historyEmpty: "No jobs yet.",
    noTable: "The table hlstats_gamewe_jobs is missing; the database needs collector 0.1.0 or newer.",
    colNo: "No.",
    colRanking: "Ranking",
    colBy: "By",
    colAt: "Created",
    colStarted: "Started",
    colTook: "Took",
    colResult: "Result",
    by: "by",
    bySchedule: "schedule",
    anAdmin: "an admin",
    status: { pending: "Waiting", running: "Running", done: "Done", failed: "Failed" } as Record<string, string>,
    types: { reset: "Reset ranking", "scheduled-reset": "Scheduled reset", inactive: "Move inactive players", awards: "Daily awards" } as Record<JobType, string>,
    modes: { "player-stats": "Player statistics only", "all-stats": "All statistics", all: "Everything, players too" } as Record<ResetMode, string>,
    forDay: "for {d}",
    allRankings: "all rankings",
    openRanking: "Open",
    rankingsN: "{n} rankings",
    console: "On the console: gamewe jobs (list), gamewe jobs -queue (queue).",
  },
};

const TONE: Record<string, string> = { pending: "warn", running: "acc", done: "ok", failed: "bad" };

type Upcoming = { key: string; job: ReactNode; sub: ReactNode; next: number; plan: string; state: ReactNode; link?: string };

// Admin page Jobs: the collector's next runs (daily awards, move of inactive
// players, scheduled resets), the queue and the history of
// hlstats_gamewe_jobs.
export default async function JobsPage() {
  const user = await requireAdmin();
  // Who queued a job: names of other admins only for level 100 (as the user list).
  const isAdmin = user.acclevel >= LEVEL_ADMIN;
  const lang = await getAdminLang();
  const t = T[lang];
  const u = adminDict(lang).ui;
  const rankings = await rankingSummaries();
  const names = new Map(rankings.map((r) => [r.code, r.name]));
  const ov = await jobsOverview(rankings.map((r) => r.code));
  const now = nowUnix();
  const when = (unix: number) => fmtDateTime(unix, lang);
  const beatOk = ov.heartbeat > 0 && now - ov.heartbeat < HEARTBEAT_STALE;
  const open = (game: string) => ov.queue.find((j) => j.game === game && (j.type === "scheduled-reset" || j.type === "reset"));
  const openOf = (type: JobType) => ov.queue.find((j) => j.type === type);
  const statePill = (s: string) => (
    <span className={`pill ${TONE[s] ?? ""}`}>
      {s === "running" ? <span className="dot" /> : null}
      {t.status[s] ?? s}
    </span>
  );
  const plannedPill = (next: number) =>
    next && next < now - 60 ? <span className="pill warn">{t.overdue}</span> : <span className="pill">{t.planned}</span>;
  const relative = (next: number) => (next >= now ? fill(t.in, { d: shortDuration(next - now, lang) }) : fill(t.ago, { d: shortDuration(now - next, lang) }));
  const zone = (p: JobPlan | null) => (p?.zone ? ` (${p.zone})` : "");

  const upcoming: Upcoming[] = [];
  const daily = (key: "awards" | "inactive", type: JobType, p: JobPlan | null, cfg: string) => {
    if (!p) return;
    const queued = openOf(type);
    upcoming.push({
      key,
      job: t[key],
      sub: t[`${key}Sub`],
      next: p.enabled ? p.next : 0,
      plan: p.enabled ? fill(t.daily, { t: p.time }) + zone(p) : fill(t.offHint, { k: cfg }),
      state: queued ? statePill(queued.status) : p.enabled ? plannedPill(p.next) : <span className="pill">{t.off}</span>,
    });
  };
  daily("awards", "awards", ov.awards, "features.daily_awards");
  daily("inactive", "inactive", ov.inactive, "features.inactive_players");
  // Rankings with the same reset (time, schedule, mode; usually all that
  // follow the schedule for all rankings) share one line, unless one of
  // them has a job waiting or running.
  const groups = new Map<string, ScheduledRanking[]>();
  for (const r of ov.rankings) {
    const k = open(r.game) ? `job-${r.game}` : `${r.next} ${scheduleValue(r.schedule)} ${r.mode}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  for (const [k, rs] of groups) {
    const r = rs[0];
    const queued = open(r.game);
    const one = rs.length === 1;
    const codes = rs.map((x) => x.game);
    upcoming.push({
      key: `reset-${k}`,
      job: (
        <>
          {t.scheduled}: {one ? (names.get(r.game) ?? r.game) : fill(t.rankingsN, { n: String(rs.length) })}
        </>
      ),
      sub: `${codes.slice(0, 6).join(", ")}${codes.length > 6 ? " …" : ""} · ${t.modes[r.mode]}`,
      next: r.next,
      plan: scheduleText(lang, r.schedule) + (ov.resets ? `, ${ov.resets.time}${zone(ov.resets)}` : ""),
      state: queued ? statePill(queued.status) : r.next ? plannedPill(r.next) : <span className="pill">{t.unknown}</span>,
      link: one ? `/admin/rankings/${encodeURIComponent(r.game)}` : "/admin/rankings",
    });
  }
  // By the next run; off and unknown ones last.
  upcoming.sort((a, b) => (a.next || Infinity) - (b.next || Infinity));

  const jobName = (j: Job) => {
    const type = jobType(j.type);
    return type ? t.types[type] : j.type;
  };
  const jobDetail = (j: Job) => {
    if (j.type === "awards") return /^\d{4}-\d{2}-\d{2}$/.test(j.mode) ? fill(t.forDay, { d: new Date(`${j.mode}T12:00:00Z`).toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { timeZone: "UTC", dateStyle: "medium" }) }) : "";
    if (j.type === "reset" || j.type === "scheduled-reset") {
      const m = jobModeName(j.mode);
      return m ? t.modes[m] : j.mode;
    }
    return "";
  };
  const ranking = (j: Job) => (j.game ? (names.get(j.game) ?? j.game) : t.allRankings);
  const by = (j: Job) => (j.requestedBy === "schedule" ? t.bySchedule : isAdmin || j.requestedBy === user.username ? j.requestedBy : t.anAdmin);
  const took = (j: Job) => (j.startedAt && j.finishedAt >= j.startedAt ? shortDuration(j.finishedAt - j.startedAt, lang) : "");

  const jobRows = (jobs: Job[], queue: boolean) =>
    jobs.map((j) => (
      <tr key={j.id}>
        <td className="main">
          <span className="name">{jobName(j)}</span> <span className="subt">#{j.id}</span>
          <div className="subt">
            {[ranking(j), jobDetail(j)].filter(Boolean).join(" · ")} · {t.by} {by(j)}
          </div>
        </td>
        <td>{statePill(j.status)}</td>
        <td data-l={`${queue ? t.colAt : t.colStarted}:`}>{when(queue ? j.requestedAt : j.startedAt || j.requestedAt)}</td>
        {queue ? null : <td data-l={`${t.colTook}:`}>{took(j)}</td>}
        <td className="job-result">{j.result}</td>
      </tr>
    ));

  return (
    <>
      <PageHead
        crumbs={[[u.areaHome, "/admin"], [t.title]]}
        title={t.title}
        intro={t.intro}
        actions={
          <span className={`pill ${beatOk ? "ok" : ov.heartbeat ? "warn" : ""}`}>
            <span className="dot" />
            {beatOk ? t.collectorOk : ov.heartbeat ? fill(t.collectorStale, { t: when(ov.heartbeat) }) : t.collectorNever}
          </span>
        }
      />
      {ov.queue.length ? <AutoRefresh seconds={5} /> : <AutoRefresh seconds={60} />}
      {!beatOk ? <p className="notice error">{t.collectorDown}</p> : null}
      <section className="card">
        <header>
          <h2>{t.next}</h2>
        </header>
        {!ov.awards && !ov.inactive ? <p className="settings-help notice">{t.noPlan}</p> : null}
        {upcoming.length ? (
          <table className="cards">
            <thead>
              <tr>
                <th>{t.colJob}</th>
                <th>{t.colWhen}</th>
                <th>{t.colPlan}</th>
                <th>{t.colState}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {upcoming.map((x) => (
                <tr key={x.key}>
                  <td className="main">
                    <span className="name">{x.job}</span>
                    <div className="subt">{x.sub}</div>
                  </td>
                  <td data-l={`${t.colWhen}:`}>
                    {x.next ? (
                      <>
                        {when(x.next)} <span className="subt">{relative(x.next)}</span>
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td data-l={`${t.colPlan}:`}>{x.plan}</td>
                  <td>{x.state}</td>
                  <td className="end num">
                    {x.link ? (
                      <Link className="button small" href={x.link}>
                        {t.openRanking}
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">{t.nothingPlanned}</p>
        )}
      </section>
      {!ov.table ? (
        <p className="notice error">{t.noTable}</p>
      ) : (
        <>
          <section className="card">
            <header>
              <h2>{t.queue}</h2>
              {ov.queue.length ? <span className="pill warn">{ov.queue.length}</span> : null}
            </header>
            {ov.queue.length ? (
              <>
                <table className="cards stack">
                  <thead>
                    <tr>
                      <th>{t.colJob}</th>
                      <th>{t.colState}</th>
                      <th>{t.colAt}</th>
                      <th>{t.colResult}</th>
                    </tr>
                  </thead>
                  <tbody>{jobRows(ov.queue, true)}</tbody>
                </table>
                <p className="muted small">{t.queueHint}</p>
              </>
            ) : (
              <p className="muted">{t.queueEmpty}</p>
            )}
          </section>
          <section className="card">
            <header>
              <h2>{t.history}</h2>
            </header>
            {ov.history.length ? (
              <>
                <table className="cards stack">
                  <thead>
                    <tr>
                      <th>{t.colJob}</th>
                      <th>{t.colState}</th>
                      <th>{t.colStarted}</th>
                      <th>{t.colTook}</th>
                      <th>{t.colResult}</th>
                    </tr>
                  </thead>
                  <tbody>{jobRows(ov.history, false)}</tbody>
                </table>
                <p className="muted small">{fill(t.historyHint, { n: String(ov.history.length) })}</p>
              </>
            ) : (
              <p className="muted">{t.historyEmpty}</p>
            )}
          </section>
        </>
      )}
      <p className="muted small">{t.console}</p>
    </>
  );
}

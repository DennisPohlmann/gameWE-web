import Link from "next/link";
import type { ReactNode } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { scheduleText } from "@/components/admin/hall-schedule";
import { JobOriginLine } from "@/components/admin/job-origin";
import { PageHead } from "@/components/admin/page-head";
import { adminDict, localized } from "@/lib/admin-i18n";
import { JOBS_T } from "@/lib/admin-texts";
import { jobsOverview, type Job, type ScheduledRanking } from "@/lib/admin-jobs";
import { rankingSummaries } from "@/lib/admin-rankings";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { fmtDateTime, fmtNum, nowUnix, localeOf } from "@/lib/format";
import { scheduleValue } from "@/lib/hall-period";
import { fill, getAdminLang } from "@/lib/i18n";
import { heartbeatFresh, jobType, shortDuration, type JobPlan, type JobType } from "@/lib/job-plan";
import { jobModeName, type ResetMode } from "@/lib/reset-modes";

const TONE: Record<string, string> = { pending: "warn", running: "acc", done: "ok", failed: "bad" };

type Upcoming = { key: string; job: ReactNode; sub: ReactNode; next: number; plan: string; state: ReactNode; link?: string };

// Admin page Jobs: the collector's next runs (daily awards, move of inactive
// players, the bans-sync job, scheduled resets), the queue and the history of
// hlstats_gamewe_jobs.
export default async function JobsPage() {
  const user = await requireAdmin();
  // Who queued a job: names of other admins only for level 100 (as the user list).
  const isAdmin = user.acclevel >= LEVEL_ADMIN;
  const lang = await getAdminLang();
  const t = localized(JOBS_T, lang);
  const u = adminDict(lang).ui;
  const rankings = await rankingSummaries();
  const names = new Map(rankings.map((r) => [r.code, r.name]));
  // Templates (no servers) are never reset, also with an old plan key left.
  const ov = await jobsOverview(rankings.filter((r) => r.servers > 0).map((r) => r.code));
  const now = nowUnix();
  const when = (unix: number) => fmtDateTime(unix, lang);
  const beatOk = heartbeatFresh(ov.heartbeat, now);
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
  // The bans-sync job (features.bans_sync): Steam and the SourceBans list,
  // each with its counts; the last error below the name.
  if (ov.bans) {
    const b = ov.bans;
    const part = (key: "bansSteam" | "bansSb", x: typeof b.steam, every: string, stats: string, missing: string) => {
      const on = b.enabled && x.enabled;
      upcoming.push({
        key,
        job: t[key],
        sub: x.error ? fill(t.lastError, { e: x.error }) : t[`${key}Sub`],
        next: on ? x.next : 0,
        plan: !b.enabled ? fill(t.offHint, { k: "features.bans_sync" }) : !x.enabled ? missing : `${every} · ${stats}`,
        state: !on ? <span className="pill">{t.off}</span> : x.error ? <span className="pill bad">{t.failing}</span> : plannedPill(x.next),
      });
    };
    part("bansSteam", b.steam, fill(t.perAccount, { d: shortDuration(b.steam.every, lang) }),
      fill(t.bansStats, { c: fmtNum(b.steam.checked, lang), b: fmtNum(b.steam.count, lang), d: fmtNum(b.steam.due, lang) }), t.noKey);
    part("bansSb", b.sourcebans, fill(t.everyN, { d: shortDuration(b.sourcebans.every, lang) }), fill(t.bansSbStats, { n: fmtNum(b.sourcebans.count, lang) }), t.noSb);
  }
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
      link: one ? `/admin/rankings/${encodeURIComponent(r.game)}` : "/admin/reset#hall-of-fame",
    });
  }
  // By the next run; off and unknown ones last.
  upcoming.sort((a, b) => (a.next || Infinity) - (b.next || Infinity));

  const jobName = (j: Job) => {
    const type = jobType(j.type);
    return type ? t.types[type] : j.type;
  };
  const jobDetail = (j: Job) => {
    if (j.type === "awards") return /^\d{4}-\d{2}-\d{2}$/.test(j.mode) ? fill(t.forDay, { d: new Date(`${j.mode}T12:00:00Z`).toLocaleDateString(localeOf(lang), { timeZone: "UTC", dateStyle: "medium" }) }) : "";
    if (j.type === "reset" || j.type === "scheduled-reset") {
      const m = jobModeName(j.mode);
      return m ? t.modes[m] : j.mode;
    }
    if (j.type === "delete-player") return `#${j.mode}`;
    return "";
  };
  const ranking = (j: Job) => (j.game ? (names.get(j.game) ?? j.game) : t.allRankings);
  const by = (j: Job) => (isAdmin || j.requestedBy === user.username ? j.requestedBy : t.anAdmin);
  const took = (j: Job) => (j.startedAt && j.finishedAt >= j.startedAt ? shortDuration(j.finishedAt - j.startedAt, lang) : "");

  const jobRows = (jobs: Job[], queue: boolean) =>
    jobs.map((j) => (
      <tr key={j.id}>
        <td className="main">
          <span className="name">{jobName(j)}</span> <span className="subt">#{j.id}</span>
          <div className="subt">{[ranking(j), jobDetail(j)].filter(Boolean).join(" · ")}</div>
          <JobOriginLine origin={j.origin} requestedBy={j.requestedBy} by={by(j)} lang={lang} />
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

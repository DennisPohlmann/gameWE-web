import Form from "next/form";
import Link from "next/link";
import { resetRankingAction } from "../../actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHead } from "@/components/admin/page-head";
import { adminDict, localized } from "@/lib/admin-i18n";
import { RESET_T } from "@/lib/admin-texts";
import { scheduleText } from "@/components/admin/hall-schedule";
import { JobOriginLine } from "@/components/admin/job-origin";
import { ResetForm } from "@/components/reset-form";
import { SortableTable } from "@/components/sortable-table";
import { Empty, Pager, ROW_OPTIONS, Section, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { jobPeriod } from "@/lib/job-period";
import { rankingSummaries, resettableRankings } from "@/lib/admin-rankings";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { getAdminLang } from "@/lib/i18n";
import { dateFormat, localeOf } from "@/lib/format";
import { originText } from "@/lib/job-origin";
import { shortDuration } from "@/lib/job-plan";
import { GlobalHallCard } from "./global-hall-card";
import { RESET_MODES, collectorRunning, countJobs, getJob, jobModeName, jobsAvailable, recentJobs, resetOrigin, type ResetJob, type ResetMode } from "@/lib/reset";

function when(ts: number | null, locale: string) {
  return ts ? dateFormat(locale, { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" }).format(ts * 1000) : "";
}

export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin(LEVEL_ADMIN);
  const lang = await getAdminLang();
  const t = localized(RESET_T, lang);
  const locale = localeOf(lang);
  const sp = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const f = (s: string, v: Record<string, string>) => s.replace(/\{(\w)\}/g, (_, k) => v[k] ?? "");
  const modeName = (m: string) => {
    const k = jobModeName(m);
    return k ? t.modes[k].title : m;
  };

  // The scheduled reset for all rankings is set here too, next to the manual
  // one (it was at the end of Rankings before); only rankings with servers
  // follow it.
  const scheduled = <GlobalHallCard lang={lang} status={sp.hof} rankings={(await rankingSummaries()).filter((r) => r.servers > 0)} />;

  if (!(await jobsAvailable())) {
    return (
      <>
        <PageHead crumbs={[[adminDict(lang).ui.areaRankings, "/admin/rankings"], [t.title]]} title={t.title} />
        <p className="notice">{t.missing}</p>
        {scheduled}
      </>
    );
  }

  const games = await resettableRankings();
  const { running, beat } = await collectorRunning();
  const nowSec = Math.floor(Date.now() / 1000);
  const beatText = beat
    ? f(t.lastBeat, { a: shortDuration(nowSec - beat, lang), t: when(beat, locale), n: when(nowSec, locale) })
    : t.noBeat;
  const jobId = Number(sp.job);
  const job: ResetJob | undefined = Number.isInteger(jobId) && jobId > 0 ? await getJob(jobId) : undefined;
  const open = job && (job.status === "pending" || job.status === "running");
  // The job list: the period from ?from= / ?to= (last 14 days by default)
  // and one page of it; the page is clamped to the pages there are.
  const period = jobPeriod(strParam(sp.from), strParam(sp.to));
  const limit = rowsParam(sp.rows, 25);
  const total = await countJobs(period.start, period.end);
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(pageParam(sp.page), pages);
  const jobs = await recentJobs(period.start, period.end, limit, (page - 1) * limit);
  const keep = { from: period.from, to: period.to, rows: limit !== 25 ? limit : undefined };
  const day = (d: string) => dateFormat(locale, { year: "numeric", month: "numeric", day: "numeric" }).format(new Date(`${d}T00:00:00`));
  const a = adminDict(lang);
  // Only level 100 sees this page, so the names of all admins.
  const startedBy = (j: ResetJob) => {
    const o = originText(resetOrigin(j), j.requested_by, j.requested_by, lang, (s) => scheduleText(lang, s));
    return [o.source, ...o.parts].join(" · ");
  };

  return (
    <>
      <PageHead crumbs={[[adminDict(lang).ui.areaRankings, "/admin/rankings"], [t.title]]} title={t.title} />
      {sp.error === "confirm" ? <p className="notice error">{t.errConfirm}</p> : null}
      {sp.error === "input" ? <p className="notice error">{t.errInput}</p> : null}
      {sp.error === "db" ? <p className="notice error">{t.errDb}</p> : null}
      {sp.job && !job ? <p className="notice error">{t.unknown}</p> : null}
      {job ? (
        <div className={`notice${job.status === "failed" ? " error" : ""}`}>
          <p>
            <b>{f(t.job, { i: String(job.id), g: job.game, m: modeName(job.mode) })}</b>{" "}
            {job.status === "pending" ? t.pending : job.status === "running" ? t.running : job.status === "done" ? t.done : t.failed}
          </p>
          <JobOriginLine origin={resetOrigin(job)} requestedBy={job.requested_by} by={job.requested_by} lang={lang} />
          {sp.existing ? <p>{t.existing}</p> : null}
          {open && !running ? <p>{t.noCollector} {beatText}</p> : null}
          {job.result ? <pre className="reset-result">{job.result}</pre> : null}
          {open ? <AutoRefresh seconds={3} /> : null}
        </div>
      ) : null}
      <Section title={t.title}>
        <ResetForm
          action={resetRankingAction}
          games={games}
          game={sp.game}
          modes={RESET_MODES.map((value) => ({ value, ...t.modes[value] }))}
          labels={t}
        >
          <p className="settings-help">{t.intro}</p>
          <p className="settings-help">{t.how}</p>
          <p className="settings-help">{t.version}</p>
          <p className="settings-help">{t.templates}</p>
          {!games.length ? <p className="settings-help notice">{t.noRankings}</p> : null}
          {!running ? <p className="settings-help notice error">{t.noCollector} {beatText}</p> : null}
        </ResetForm>
      </Section>
      {scheduled}
      <Section
        id="jobs"
        title={t.recent}
        aside={
          <Form className="search" action="/admin/reset">
            <label>
              {t.from} <input {...noAutofill} type="date" name="from" defaultValue={period.from} required />
            </label>
            <label>
              {t.to} <input {...noAutofill} type="date" name="to" defaultValue={period.to} required />
            </label>
            {keep.rows ? <input type="hidden" name="rows" value={keep.rows} /> : null}
            <button type="submit">{a.filter}</button>
          </Form>
        }
      >
        {period.invalid ? <p className="notice error">{t.errRange}</p> : null}
        <p className="settings-help">{f(t.recentHelp, { f: day(period.from), t: day(period.to) })}</p>
        {jobs.length ? (
          <>
          <TableWrap>
          <SortableTable
            initial={0}
            cols={[
              { label: t.colId },
              { label: t.colGame },
              { label: t.colMode },
              { label: t.colStatus },
              { label: t.colBy },
              { label: t.colAt },
              { label: t.colResult, className: "reset-result-cell", noSort: true },
            ]}
            rows={jobs.map((j) => ({
              key: j.id,
              values: [Number(j.id), j.game, modeName(j.mode), j.status, startedBy(j), Number(j.requested_at), null],
              cells: [
                <Link prefetch={false} key="id" href={`/admin/reset?job=${j.id}`}>
                  {j.id}
                </Link>,
                j.game,
                modeName(j.mode),
                j.status,
                startedBy(j),
                when(Number(j.requested_at), locale),
                j.result ?? "",
              ],
            }))}
          />
          </TableWrap>
          <Pager base="/admin/reset" params={keep} page={page} pages={pages} total={total} rows={{ value: limit, options: ROW_OPTIONS }} locale={locale} labels={a.pager} />
          </>
        ) : (
          <Empty>{t.noJobs}</Empty>
        )}
      </Section>
    </>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { AutoRefresh } from "@/components/auto-refresh";
import { PageHead } from "@/components/admin/page-head";
import { adminDict } from "@/lib/admin-i18n";
import { requireAdmin } from "@/lib/auth";
import { collectorSchema, collectorStatus } from "@/lib/collector-status";
import { adminQuery } from "@/lib/db";
import { fmtDateTime, nowUnix } from "@/lib/format";
import { fill, getAdminLang } from "@/lib/i18n";
import { shortDuration } from "@/lib/job-plan";
import { releasePage } from "@/lib/update-version";
import { updateStatus } from "@/lib/updates";

// The collector's state for every admin (the link at the bottom of the admin
// menu): running or not, last sign of life, version, environment, database
// schema and open jobs, all from what the collector writes. Read only.
export default async function CollectorPage() {
  await requireAdmin();
  const lang = await getAdminLang();
  const u = adminDict(lang).ui;
  const [st, schema, updates, open] = await Promise.all([
    collectorStatus(),
    collectorSchema(),
    updateStatus(),
    adminQuery<{ n: number | string }>(`SELECT COUNT(*) AS n FROM hlstats_gamewe_jobs WHERE status IN ('pending', 'running')`)
      .then((r) => Number(r[0]?.n ?? 0))
      .catch(() => null),
  ]);
  const now = nowUnix();
  const pill = { ok: "pill ok", stale: "pill warn", never: "pill" }[st.state];
  const stateText = { ok: u.csOk, stale: fill(u.csStale, { t: st.heartbeat ? fmtDateTime(st.heartbeat, lang) : "?" }), never: u.csNever }[st.state];
  const stateSub = { ok: u.cStateOk, stale: u.cStateStale, never: u.cStateNever }[st.state];
  const release = releasePage("collector", st.version);
  const update = updates.updates.find((x) => x.component === "collector");
  const runtime = st.runtime === "docker" ? u.cRuntimeDocker : st.runtime === "container" ? u.cRuntimeContainer : u.cRuntimeHost;
  const rows: [string, ReactNode][] = [
    [
      u.cState,
      <>
        <span className={pill}>
          {st.state === "ok" ? <span className="dot" /> : null}
          {stateText}
        </span>
        <small className="muted">{stateSub}</small>
      </>,
    ],
    [u.cLastSeen, st.heartbeat ? `${fmtDateTime(st.heartbeat, lang)} (${fill(u.cAgo, { d: shortDuration(Math.max(0, now - st.heartbeat), lang) })})` : "–"],
    [
      u.cVersion,
      st.version ? (
        release ? (
          <a href={release} target="_blank" rel="noopener noreferrer">
            v{st.version}
          </a>
        ) : (
          `v${st.version}`
        )
      ) : (
        u.cVersionUnknown
      ),
    ],
    [u.cRuntime, st.version ? runtime : "–"],
    [
      u.cUpdate,
      update ? (
        <a href={update.url} target="_blank" rel="noopener noreferrer">
          {fill(u.footUpdate, { v: `v${update.latest}` })}
        </a>
      ) : (
        u.cUpdateNone
      ),
    ],
    [u.cSchema, schema ? `${fill(u.cSchemaVersion, { v: String(schema.version) })}${schema.at ? ` · ${fmtDateTime(Number(schema.at), lang)}` : ""}` : u.cSchemaUnknown],
    [u.cJobs, <Link prefetch={false} href="/admin/jobs">{open === null ? "–" : open ? fill(u.cJobsOpen, { n: String(open) }) : u.cJobsNone}</Link>],
  ];
  return (
    <>
      <AutoRefresh seconds={30} />
      <PageHead crumbs={[[u.areaHome, "/admin"], [u.navCollector]]} title={u.navCollector} intro={u.collectorIntro} />
      <section className="card">
        <dl className="kv">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

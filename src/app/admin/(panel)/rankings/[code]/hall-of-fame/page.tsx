import Link from "next/link";
import { notFound } from "next/navigation";
import { hallEntryAction } from "../../../../actions";
import { PageHead } from "@/components/admin/page-head";
import { hallEntries, hallSettings } from "@/lib/admin-hall";
import { adminDict, localized } from "@/lib/admin-i18n";
import { HALL_PAGE_T } from "@/lib/admin-texts";
import { rankingSummaries } from "@/lib/admin-rankings";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { basePath } from "@/lib/base-path";
import { localeOf } from "@/lib/format";
import { periodLabel, podium, type HallUnit } from "@/lib/hall-period";
import { getAdminLang } from "@/lib/i18n";

// All stored hall of fame entries of a ranking, to remove or bring back
// (admins only).
export default async function HallOfFameEditPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin(LEVEL_ADMIN);
  const code = decodeURIComponent((await params).code);
  const status = (await searchParams).hof;
  const r = (await rankingSummaries()).find((x) => x.code === code);
  if (!r) notFound();
  const lang = await getAdminLang();
  const u = adminDict(lang).ui;
  const t = localized(HALL_PAGE_T, lang);
  const locale = localeOf(lang);
  const nf = (n: number) => n.toLocaleString(locale);
  const [s, periods] = await Promise.all([hallSettings(code), hallEntries(code).catch(() => [])]);
  const msg = { removed: t.removed, restored: t.restored, input: t.errInput, confirm: t.errConfirm }[status ?? ""];
  const back = `/admin/rankings/${encodeURIComponent(code)}`;
  const Op = ({ start, place, op, sure, label, cls }: { start: string; place?: number; op: "remove" | "restore"; sure?: string; label: string; cls?: string }) => {
    const form = (
      <form action={hallEntryAction} className="hof-op">
        <input type="hidden" name="game" value={code} />
        <input type="hidden" name="start" value={start} />
        <input type="hidden" name="place" value={place ?? ""} />
        <input type="hidden" name="op" value={op} />
        {sure ? <input type="hidden" name="confirm" value="yes" /> : null}
        <button type="submit" className={`button small ${sure ? "danger" : ""}`}>
          {sure ?? label}
        </button>
      </form>
    );
    // Removing takes two clicks: the first opens the confirmation.
    return sure ? (
      <details className={`hof-confirm ${cls ?? ""}`}>
        <summary className="button small">{label}</summary>
        {form}
      </details>
    ) : (
      form
    );
  };
  return (
    <>
      <PageHead
        crumbs={[[u.areaRankings, "/admin/rankings"], [r.name, back], [t.title]]}
        title={t.title}
        intro={t.intro}
        actions={
          <>
            <Link prefetch={false} className="button" href={`${back}#hall-of-fame`}>
              {t.settings}
            </Link>
            {periods.length ? (
              <a className="button" href={`${basePath}/${encodeURIComponent(code)}/hall-of-fame`} target="_blank" rel="noopener">
                {t.view}
              </a>
            ) : (
              // Nothing to see before the first reset: greyed out, the
              // reason on hover (a disabled button shows no tooltip in
              // every browser) and for screen readers.
              <span className="button" role="link" aria-disabled="true" tabIndex={0} title={t.viewNone} aria-label={`${t.view}: ${t.viewNone}`}>
                {t.view}
              </span>
            )}
          </>
        }
      />
      {msg ? <p className={status === "removed" || status === "restored" ? "notice" : "notice error"}>{msg}</p> : null}
      {!s.removable && periods.length ? <p className="notice error">{t.old}</p> : null}
      {!periods.length ? <p className="muted">{t.empty}</p> : null}
      {periods.map((p) => {
        const shown = new Map(podium(p.entries.map((e) => ({ ...e, stored: e.place }))).map((e) => [e.stored, e.place]));
        const allRemoved = p.entries.every((e) => e.removed);
        return (
          <section className="card" key={p.start} id={`p-${p.start}`}>
            <header>
              <h2>{periodLabel({ unit: p.unit as HallUnit, every: p.every, start: p.start, end: p.end }, locale, t.week)}</h2>
              {s.removable ? (
                allRemoved ? (
                  <Op start={p.start} op="restore" label={t.restoreAll} />
                ) : (
                  <Op start={p.start} op="remove" label={t.removeAll} sure={t.removeAllSure} cls="end" />
                )
              ) : null}
            </header>
            <table className="cards">
              <thead>
                <tr>
                  <th className="num">{t.stored}</th>
                  <th className="num">{t.shown}</th>
                  <th>{t.player}</th>
                  <th className="num">{t.skill}</th>
                  <th className="num">{t.kills}</th>
                  <th>{t.status}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.entries.map((e) => {
                  const place = shown.get(e.place);
                  return (
                    <tr key={e.place} className={e.removed ? "muted" : undefined}>
                      <td className="num">{e.place}.</td>
                      <td className="num">{place ? `${place}.` : "–"}</td>
                      <td className="main">
                        {e.currentName !== null ? (
                          <Link prefetch={false} className="name" href={`/admin/players/${e.playerId}`}>
                            <bdi>{e.currentName}</bdi>
                          </Link>
                        ) : (
                          <span className="name"><bdi>{e.name}</bdi></span>
                        )}
                        {e.currentName && e.currentName !== e.name ? (
                          <span className="subt">
                            {" "}
                            {t.then}: <bdi>{e.name}</bdi>
                          </span>
                        ) : null}
                      </td>
                      <td className="num" data-l={`${t.skill}:`}>
                        {nf(e.skill)}
                      </td>
                      <td className="num" data-l={`${t.kills}:`}>
                        {nf(e.kills)}
                      </td>
                      <td>
                        {e.removed ? <span className="pill bad">{t.removedPill}</span> : null}
                        {e.hidden ? <span className="pill warn">{t.hiddenPill}</span> : null}
                        {!e.removed && !e.hidden && !place ? <span className="pill">{t.reserve}</span> : null}
                      </td>
                      <td className="end nowrap">
                        {s.removable ? (
                          e.removed ? (
                            <Op start={p.start} place={e.place} op="restore" label={t.restore} />
                          ) : (
                            <Op start={p.start} place={e.place} op="remove" label={t.remove} sure={t.removeSure} />
                          )
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}

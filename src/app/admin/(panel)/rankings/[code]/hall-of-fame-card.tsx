import Link from "next/link";
import { hallOfFameSettingsAction } from "../../../actions";
import { HallScheduleFields, hallT, scheduleText } from "@/components/admin/hall-schedule";
import { noAutofill } from "@/lib/autofill";
import { basePath } from "@/lib/base-path";
import { hallSettings } from "@/lib/admin-hall";
import { nextStart } from "@/lib/hall-period";
import type { Lang } from "@/lib/i18n";
import { localeOf } from "@/lib/format";
import { localized } from "@/lib/admin-i18n";
import { HALL_CARD_T } from "@/lib/admin-texts";

// Scheduled reset and hall of fame of one ranking (admins only).
export async function HallOfFameCard({ game, lang, status }: { game: string; lang: Lang; status?: string }) {
  const t = localized(HALL_CARD_T, lang);
  const ht = hallT(lang);
  const locale = localeOf(lang);
  const s = await hallSettings(game);
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC" });
  const f = (v: string, m: Record<string, string>) => v.replace(/\{(\w)\}/g, (_, k) => m[k] ?? "");
  const msg = { saved: t.saved, input: t.errInput, confirm: t.errConfirm, table: t.errTable }[status ?? ""];
  return (
    <section className="card" id="hall-of-fame">
      <header>
        <h2>{t.title}</h2>
        <span className="hof-links">
          <Link prefetch={false} className="more" href={`/admin/rankings/${encodeURIComponent(game)}/hall-of-fame`}>
            {t.edit}
          </Link>
          {s.entries ? (
            <a className="more" href={`${basePath}/${encodeURIComponent(game)}/hall-of-fame`} target="_blank" rel="noopener">
              {t.view}
            </a>
          ) : (
            // Nothing to see before the first reset (as on the edit page).
            <span className="more off" role="link" aria-disabled="true" tabIndex={0} title={t.viewNone} aria-label={`${t.view}: ${t.viewNone}`}>
              {t.view}
            </span>
          )}
        </span>
      </header>
      {msg ? <p className={status === "saved" ? "notice" : "notice error"}>{msg}</p> : null}
      <form action={hallOfFameSettingsAction} className="form box hof-form">
        <input type="hidden" name="game" value={game} />
        <p>{t.intro}</p>
        {s.effective ? (
          <p className="muted">
            {s.last ? f(t.since, { d: date(new Date(s.last * 1000 + 43_200_000).toISOString().slice(0, 10)), n: date(nextStart(s.last, s.effective)) }) : t.waiting}
          </p>
        ) : null}
        <fieldset className="hof-source">
          <legend>{t.source}</legend>
          {(["global", "own", "off"] as const).map((v) => (
            <label key={v} className="check">
              <input type="radio" name="source" value={v} defaultChecked={s.source === v} />
              {t.sources[v]}
              {v === "global" ? (
                <small>
                  {f(t.globalNow, { s: s.global.schedule ? scheduleText(lang, s.global.schedule) : ht.units.off })}{" "}
                  <Link prefetch={false} href="/admin/reset#hall-of-fame">{t.globalEdit}</Link>
                </small>
              ) : null}
            </label>
          ))}
        </fieldset>
        <div className="hof-own">
          <HallScheduleFields lang={lang} schedule={s.schedule} mode={s.mode} />
        </div>
        <label>
          {t.page}
          <select {...noAutofill} name="page" defaultValue={s.page}>
            {(["auto", "on", "off"] as const).map((p) => (
              <option key={p} value={p}>
                {t.pages[p]}
              </option>
            ))}
          </select>
          <small>{t.pageHelp}</small>
        </label>
        <label className="check">
          <input type="checkbox" name="understood" value="yes" />
          {t.understood}
        </label>
        <button type="submit" className="button primary">
          {t.save}
        </button>
        <small>
          {s.entries ? `${f(t.entries, { n: String(s.entries) })} ` : ""}
          {ht.time} {f(t.cli, { g: game })}
        </small>
      </form>
    </section>
  );
}

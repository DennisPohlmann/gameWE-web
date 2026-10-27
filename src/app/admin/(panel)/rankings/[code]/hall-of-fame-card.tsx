import Link from "next/link";
import { hallOfFameSettingsAction } from "../../../actions";
import { HallScheduleFields, hallT, scheduleText } from "@/components/admin/hall-schedule";
import { noAutofill } from "@/lib/autofill";
import { basePath } from "@/lib/base-path";
import { hallSettings } from "@/lib/admin-hall";
import { nextStart } from "@/lib/hall-period";
import type { Lang } from "@/lib/i18n";

const T = {
  de: {
    title: "Ruhmeshalle & geplanter Reset",
    intro:
      "Setzt die Rangliste am Ende jeder Periode zurück. Vorher speichert der Collector die besten fünf Spieler mit ihren Werten in der Ruhmeshalle; die ersten drei stehen auf dem Podest, die anderen rücken nach, wenn ein Eintrag entfernt wird. Die Perioden richten sich nach dem Kalender in der Zeitzone des Collectors.",
    source: "Zeitplan",
    sources: { global: "Wie für alle Rankings", own: "Eigener Zeitplan", off: "Aus (kein geplanter Reset)" },
    globalNow: "Für alle Rankings gilt: {s}",
    globalEdit: "Ändern",
    page: "Seite „Ruhmeshalle“",
    pageHelp: "Automatisch: sichtbar, solange ein Reset geplant ist oder Einträge da sind.",
    pages: { auto: "Automatisch", on: "Immer zeigen", off: "Ausblenden" },
    understood: "Mir ist klar, dass die Statistiken dieser Rangliste am Ende jeder Periode unwiderruflich zurückgesetzt werden.",
    save: "Speichern",
    since: "Laufende Periode seit {d}, nächster Reset am {n}.",
    waiting: "Der Collector beginnt die Periode beim nächsten Durchlauf (innerhalb einer Minute, sobald er läuft).",
    entries: "Einträge in der Ruhmeshalle: {n} Perioden.",
    edit: "Einträge bearbeiten",
    view: "Ruhmeshalle ansehen",
    saved: "Gespeichert.",
    errInput: "Nicht gespeichert: ungültige Eingabe.",
    errConfirm: "Nicht gespeichert: Bitte bestätigen, dass die Rangliste regelmäßig zurückgesetzt wird.",
    errTable: "Nicht gespeichert: Die Datenbank hat die Tabelle hlstats_gamewe_hall_of_fame noch nicht. Den Collector aktualisieren (er legt sie mit gamewe db migrate an).",
    cli: "Auf der Konsole: gamewe halloffame schedule {g} [EVERY|off|inherit] -mode MODE",
  },
  en: {
    title: "Hall of fame & scheduled reset",
    intro:
      "Resets the ranking at the end of every period. Before that, the collector stores the best five players with their values in the hall of fame; the first three are on the podium, the others move up when an entry is removed. The periods follow the calendar in the collector's time zone.",
    source: "Schedule",
    sources: { global: "As for all rankings", own: "Own schedule", off: "Off (no scheduled reset)" },
    globalNow: "For all rankings: {s}",
    globalEdit: "Change",
    page: "“Hall of Fame” page",
    pageHelp: "Automatic: shown while a reset is scheduled or entries exist.",
    pages: { auto: "Automatic", on: "Always show", off: "Hide" },
    understood: "I understand that the statistics of this ranking will be reset irreversibly at the end of every period.",
    save: "Save",
    since: "Current period since {d}, next reset on {n}.",
    waiting: "The collector starts the period with its next run (within a minute while it runs).",
    entries: "Hall of fame entries: {n} periods.",
    edit: "Edit entries",
    view: "View hall of fame",
    saved: "Saved.",
    errInput: "Not saved: invalid input.",
    errConfirm: "Not saved: please confirm that the ranking will be reset regularly.",
    errTable: "Not saved: the database does not have the table hlstats_gamewe_hall_of_fame yet. Update the collector (gamewe db migrate creates it).",
    cli: "From the console: gamewe halloffame schedule {g} [EVERY|off|inherit] -mode MODE",
  },
};

// Scheduled reset and hall of fame of one ranking (admins only).
export async function HallOfFameCard({ game, lang, status }: { game: string; lang: Lang; status?: string }) {
  const t = T[lang === "de" ? "de" : "en"];
  const ht = hallT(lang);
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const s = await hallSettings(game);
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC" });
  const f = (v: string, m: Record<string, string>) => v.replace(/\{(\w)\}/g, (_, k) => m[k] ?? "");
  const msg = { saved: t.saved, input: t.errInput, confirm: t.errConfirm, table: t.errTable }[status ?? ""];
  return (
    <section className="card" id="hall-of-fame">
      <header>
        <h2>{t.title}</h2>
        <span className="hof-links">
          {s.entries ? (
            <Link className="more" href={`/admin/rankings/${encodeURIComponent(game)}/hall-of-fame`}>
              {t.edit}
            </Link>
          ) : null}
          {s.entries || s.effective ? (
            <a className="more" href={`${basePath}/${encodeURIComponent(game)}/hall-of-fame`} target="_blank" rel="noopener">
              {t.view}
            </a>
          ) : null}
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
                  <Link href="/admin/rankings#hall-of-fame">{t.globalEdit}</Link>
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

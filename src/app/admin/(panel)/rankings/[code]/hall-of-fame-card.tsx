import { hallOfFameSettingsAction } from "../../../actions";
import { basePath } from "@/lib/base-path";
import { hallSettings } from "@/lib/admin-hall";
import { MAX_EVERY, nextStart } from "@/lib/hall-period";
import type { Lang } from "@/lib/i18n";
import { RESET_MODES, type ResetMode } from "@/lib/reset-modes";

const T = {
  de: {
    title: "Ruhmeshalle & geplanter Reset",
    intro:
      "Setzt die Rangliste am Ende jeder Periode zurück. Vorher speichert der Collector die besten drei Spieler mit ihren Werten in der Ruhmeshalle; dort bleiben sie dauerhaft. Die Perioden richten sich nach dem Kalender in der Zeitzone des Collectors (Woche ab Montag, Monat ab dem 1.).",
    every: "Reset",
    everyHelp: "Alle N Tage, Wochen, Monate oder Jahre, z. B. alle 2 Monate. Vierteljährlich = alle 3 Monate.",
    units: { off: "Aus (kein geplanter Reset)", day: "Tage", week: "Wochen", month: "Monate", quarter: "Quartale", year: "Jahre" },
    all: "alle",
    mode: "Was zurücksetzen?",
    modes: { "player-stats": "Nur Spielerstatistiken", "all-stats": "Alle Statistiken", all: "Alles, auch die Spieler" } as Record<ResetMode, string>,
    page: "Seite „Ruhmeshalle“",
    pageHelp: "Automatisch: sichtbar, solange ein Reset geplant ist oder Einträge da sind.",
    pages: { auto: "Automatisch", on: "Immer zeigen", off: "Ausblenden" },
    understood: "Mir ist klar, dass die Statistiken dieser Rangliste am Ende jeder Periode unwiderruflich zurückgesetzt werden.",
    save: "Speichern",
    since: "Laufende Periode seit {d}, nächster Reset am {n} (00:00 Uhr Collector-Zeit).",
    waiting: "Der Collector beginnt die Periode beim nächsten Durchlauf (innerhalb einer Minute, sobald er läuft).",
    entries: "Einträge in der Ruhmeshalle: {n} Perioden.",
    view: "Ruhmeshalle ansehen",
    saved: "Gespeichert.",
    errInput: "Nicht gespeichert: ungültige Eingabe.",
    errConfirm: "Nicht gespeichert: Bitte bestätigen, dass die Rangliste regelmäßig zurückgesetzt wird.",
    errTable: "Nicht gespeichert: Die Datenbank hat die Tabelle hlstats_gamewe_hall_of_fame noch nicht. Den Collector aktualisieren (er legt sie mit gamewe db migrate an).",
    cli: "Auf der Konsole: gamewe halloffame schedule {g} [EVERY] -mode MODE",
  },
  en: {
    title: "Hall of fame & scheduled reset",
    intro:
      "Resets the ranking at the end of every period. Before that, the collector stores the best three players with their values in the hall of fame, where they stay for good. The periods follow the calendar in the collector's time zone (weeks from Monday, months from the 1st).",
    every: "Reset",
    everyHelp: "Every N days, weeks, months or years, e.g. every 2 months. Quarterly = every 3 months.",
    units: { off: "Off (no scheduled reset)", day: "days", week: "weeks", month: "months", quarter: "quarters", year: "years" },
    all: "every",
    mode: "What to reset?",
    modes: { "player-stats": "Player statistics only", "all-stats": "All statistics", all: "Everything, players too" } as Record<ResetMode, string>,
    page: "“Hall of Fame” page",
    pageHelp: "Automatic: shown while a reset is scheduled or entries exist.",
    pages: { auto: "Automatic", on: "Always show", off: "Hide" },
    understood: "I understand that the statistics of this ranking will be reset irreversibly at the end of every period.",
    save: "Save",
    since: "Current period since {d}, next reset on {n} (00:00 collector time).",
    waiting: "The collector starts the period with its next run (within a minute while it runs).",
    entries: "Hall of fame entries: {n} periods.",
    view: "View hall of fame",
    saved: "Saved.",
    errInput: "Not saved: invalid input.",
    errConfirm: "Not saved: please confirm that the ranking will be reset regularly.",
    errTable: "Not saved: the database does not have the table hlstats_gamewe_hall_of_fame yet. Update the collector (gamewe db migrate creates it).",
    cli: "From the console: gamewe halloffame schedule {g} [EVERY] -mode MODE",
  },
};

// Scheduled reset and hall of fame of one ranking (admins only).
export async function HallOfFameCard({ game, lang, status }: { game: string; lang: Lang; status?: string }) {
  const t = T[lang === "de" ? "de" : "en"];
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const s = await hallSettings(game);
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC" });
  const f = (v: string, m: Record<string, string>) => v.replace(/\{(\w)\}/g, (_, k) => m[k] ?? "");
  // A schedule of every 3 (6, ...) months is offered as quarters.
  const unit = !s.schedule ? "off" : s.schedule.unit === "month" && s.schedule.every % 3 === 0 ? "quarter" : s.schedule.unit;
  const every = !s.schedule ? 1 : unit === "quarter" ? s.schedule.every / 3 : s.schedule.every;
  const msg = { saved: t.saved, input: t.errInput, confirm: t.errConfirm, table: t.errTable }[status ?? ""];
  return (
    <section className="card" id="hall-of-fame">
      <header>
        <h2>{t.title}</h2>
        {s.entries || s.schedule ? (
          <a className="more" href={`${basePath}/${encodeURIComponent(game)}/hall-of-fame`} target="_blank" rel="noopener">
            {t.view}
          </a>
        ) : null}
      </header>
      {msg ? <p className={status === "saved" ? "notice" : "notice error"}>{msg}</p> : null}
      <form action={hallOfFameSettingsAction} className="form box">
        <input type="hidden" name="game" value={game} />
        <p>{t.intro}</p>
        {s.schedule ? <p className="muted">{s.last ? f(t.since, { d: date(new Date(s.last * 1000 + 43_200_000).toISOString().slice(0, 10)), n: date(nextStart(s.last, s.schedule)) }) : t.waiting}</p> : null}
        <label>
          {t.every}
          <span className="hof-every">
            <span>{t.all}</span>
            <input type="number" name="every" min={1} max={MAX_EVERY} defaultValue={every} />
            <select name="unit" defaultValue={unit}>
              {(["off", "day", "week", "month", "quarter", "year"] as const).map((u) => (
                <option key={u} value={u}>
                  {t.units[u]}
                </option>
              ))}
            </select>
          </span>
          <small>{t.everyHelp}</small>
        </label>
        <label>
          {t.mode}
          <select name="mode" defaultValue={s.mode}>
            {RESET_MODES.map((m) => (
              <option key={m} value={m}>
                {t.modes[m]}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.page}
          <select name="page" defaultValue={s.page}>
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
        <small>{s.entries ? `${f(t.entries, { n: String(s.entries) })} ` : ""}{f(t.cli, { g: game })}</small>
      </form>
    </section>
  );
}

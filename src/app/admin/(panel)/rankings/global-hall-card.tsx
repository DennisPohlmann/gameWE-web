import Link from "next/link";
import { globalHallAction } from "../../actions";
import { HallScheduleFields, hallT, scheduleText } from "@/components/admin/hall-schedule";
import { globalHall, inheritingRankings } from "@/lib/admin-hall";
import { nextStart } from "@/lib/hall-period";
import type { Lang } from "@/lib/i18n";

const T = {
  de: {
    title: "Geplanter Reset für alle Rankings",
    intro:
      "Ein Zeitplan für alle Rankings, z. B. jedes Quartal. Jedes Ranking mit Servern folgt ihm, solange es auf „Wie für alle Rankings“ steht, Vorlagen (Rankings ohne Server) nie; in seinen Einstellungen lässt es sich mit einem eigenen Zeitplan oder „Aus“ überschreiben. Vor jedem Reset kommen die Besten der Periode in die Ruhmeshalle des Rankings.",
    on: "An",
    off: "Aus",
    enabled: "Reset für alle Rankings",
    enabledHelp: "Aus: Kein Ranking wird nach diesem Zeitplan zurückgesetzt. Der Zeitplan bleibt gespeichert und gilt wieder, sobald du ihn einschaltest.",
    stateOn: "Aktiv: {s}, {m}.",
    stateOff: "Ausgeschaltet. Gespeicherter Zeitplan: {s}, {m}.",
    stateNone: "Ausgeschaltet. Noch kein Zeitplan eingerichtet.",
    next: "Nächster Reset am {n}.",
    waiting: "Der Collector beginnt die Periode beim nächsten Durchlauf (innerhalb einer Minute, sobald er läuft).",
    follow: "Folgen diesem Zeitplan: {r}.",
    none: "Kein Ranking folgt diesem Zeitplan, alle haben einen eigenen oder stehen auf „Aus“ (Vorlagen ohne Server zählen nicht).",
    understood: "Mir ist klar, dass die Statistiken aller Rankings, die diesem Zeitplan folgen, am Ende jeder Periode unwiderruflich zurückgesetzt werden.",
    save: "Speichern",
    savedOn: "Gespeichert: Der Reset für alle Rankings ist eingeschaltet. Der Collector übernimmt ihn innerhalb einer Minute und beginnt mit der laufenden Periode, es wird also nicht sofort zurückgesetzt.",
    savedOff: "Gespeichert: Der Reset für alle Rankings ist ausgeschaltet. Die Rankings, die ihm folgen, werden nicht mehr zurückgesetzt.",
    errInput: "Nicht gespeichert: ungültige Eingabe.",
    errConfirm: "Nicht gespeichert: Bitte bestätigen, dass die Rankings regelmäßig zurückgesetzt werden.",
    cli: "Auf der Konsole: gamewe halloffame schedule -all [EVERY|off] -mode MODE",
  },
  en: {
    title: "Scheduled reset for all rankings",
    intro:
      "One schedule for all rankings, e.g. every quarter. A ranking with servers follows it while it is set to “As for all rankings”, templates (rankings without servers) never do; its own settings can override it with an own schedule or “Off”. Before every reset the best of the period go into the ranking's hall of fame.",
    on: "On",
    off: "Off",
    enabled: "Reset for all rankings",
    enabledHelp: "Off: no ranking is reset on this schedule. The schedule stays stored and applies again as soon as you switch it on.",
    stateOn: "Active: {s}, {m}.",
    stateOff: "Switched off. Stored schedule: {s}, {m}.",
    stateNone: "Switched off. No schedule set up yet.",
    next: "Next reset on {n}.",
    waiting: "The collector starts the period with its next run (within a minute while it runs).",
    follow: "Following this schedule: {r}.",
    none: "No ranking follows this schedule; all have their own or are off (templates without servers do not count).",
    understood: "I understand that the statistics of all rankings following this schedule will be reset irreversibly at the end of every period.",
    save: "Save",
    savedOn: "Saved: the reset for all rankings is switched on. The collector takes it within a minute and starts with the period now running, so nothing is reset at once.",
    savedOff: "Saved: the reset for all rankings is switched off. The rankings that follow it are no longer reset.",
    errInput: "Not saved: invalid input.",
    errConfirm: "Not saved: please confirm that the rankings will be reset regularly.",
    cli: "From the console: gamewe halloffame schedule -all [EVERY|off] -mode MODE",
  },
};

// The reset schedule for all rankings (admins only); rankings: those with
// servers, templates are never reset.
export async function GlobalHallCard({ lang, status, rankings }: { lang: Lang; status?: string; rankings: { code: string; name: string }[] }) {
  const t = T[lang === "de" ? "de" : "en"];
  const ht = hallT(lang);
  const codes = rankings.map((r) => r.code);
  const [g, following] = await Promise.all([globalHall(codes), inheritingRankings(codes)]);
  const msg = { on: t.savedOn, off: t.savedOff, input: t.errInput, confirm: t.errConfirm }[status ?? ""];
  const names = rankings.filter((r) => following.includes(r.code));
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC" });
  const what = g.schedule ? { s: scheduleText(lang, g.schedule), m: ht.modes[g.mode].replace(/^./, (c) => c.toLowerCase()) } : null;
  const fill = (v: string, m: Record<string, string>) => v.replace(/\{(\w)\}/g, (_, k) => m[k] ?? "");
  let state = what ? fill(g.enabled ? t.stateOn : t.stateOff, what) : t.stateNone;
  if (g.enabled && g.schedule && names.length) state += ` ${g.last ? fill(t.next, { n: date(nextStart(g.last, g.schedule)) }) : t.waiting}`;
  return (
    <section className="card" id="hall-of-fame">
      <header>
        <h2>{t.title}</h2>
        <span className={g.enabled ? "pill ok" : "pill"}>{g.enabled ? t.on : t.off}</span>
      </header>
      {msg ? <p className={status === "on" || status === "off" ? "notice" : "notice error"}>{msg}</p> : null}
      <form action={globalHallAction} className="form box hof-form">
        <p>{t.intro}</p>
        <div className="hof-switch">
          <label className="switch">
            <input type="checkbox" name="enabled" value="yes" defaultChecked={g.enabled} />
            <i aria-hidden="true" />
            <b>{t.enabled}:</b>
            <span className="on-t">{t.on}</span>
            <span className="off-t">{t.off}</span>
          </label>
          <small>{t.enabledHelp}</small>
        </div>
        <p className={g.enabled ? "notice hof-state" : "notice info hof-state"}>{state}</p>
        <div className="hof-sched">
          <HallScheduleFields lang={lang} schedule={g.schedule} mode={g.mode} />
        </div>
        <p className="muted">
          {names.length
            ? t.follow.split("{r}").flatMap((part, i) =>
                i === 0
                  ? [part]
                  : [
                      ...names.flatMap((r, j) => [
                        j ? ", " : "",
                        <Link key={r.code} href={`/admin/rankings/${encodeURIComponent(r.code)}#hall-of-fame`}>
                          {r.name}
                        </Link>,
                      ]),
                      part,
                    ],
              )
            : t.none}
        </p>
        <label className="check hof-understood">
          <input type="checkbox" name="understood" value="yes" />
          {t.understood}
        </label>
        <button type="submit" className="button primary">
          {t.save}
        </button>
        <small>
          {ht.time} {t.cli}
        </small>
      </form>
    </section>
  );
}

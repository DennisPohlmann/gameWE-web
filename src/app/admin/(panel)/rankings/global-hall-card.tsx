import Link from "next/link";
import { globalHallAction } from "../../actions";
import { HallScheduleFields, hallT } from "@/components/admin/hall-schedule";
import { globalHall, inheritingRankings } from "@/lib/admin-hall";
import type { Lang } from "@/lib/i18n";

const T = {
  de: {
    title: "Geplanter Reset für alle Rankings",
    intro:
      "Ein Zeitplan für alle Rankings, z. B. jedes Quartal. Jedes Ranking folgt ihm, solange es auf „Wie für alle Rankings“ steht; in seinen Einstellungen lässt es sich mit einem eigenen Zeitplan oder „Aus“ überschreiben. Vor jedem Reset kommen die Besten der Periode in die Ruhmeshalle des Rankings.",
    follow: "Folgen diesem Zeitplan: {r}.",
    none: "Kein Ranking folgt diesem Zeitplan, alle haben einen eigenen oder stehen auf „Aus“.",
    understood: "Mir ist klar, dass die Statistiken aller Rankings, die diesem Zeitplan folgen, am Ende jeder Periode unwiderruflich zurückgesetzt werden.",
    save: "Speichern",
    saved: "Gespeichert. Der Collector übernimmt den Zeitplan innerhalb einer Minute und beginnt mit der laufenden Periode, es wird also nicht sofort zurückgesetzt.",
    errInput: "Nicht gespeichert: ungültige Eingabe.",
    errConfirm: "Nicht gespeichert: Bitte bestätigen, dass die Rankings regelmäßig zurückgesetzt werden.",
    cli: "Auf der Konsole: gamewe halloffame schedule -all [EVERY|off] -mode MODE",
  },
  en: {
    title: "Scheduled reset for all rankings",
    intro:
      "One schedule for all rankings, e.g. every quarter. A ranking follows it while it is set to “As for all rankings”; its own settings can override it with an own schedule or “Off”. Before every reset the best of the period go into the ranking's hall of fame.",
    follow: "Following this schedule: {r}.",
    none: "No ranking follows this schedule; all have their own or are off.",
    understood: "I understand that the statistics of all rankings following this schedule will be reset irreversibly at the end of every period.",
    save: "Save",
    saved: "Saved. The collector takes the schedule within a minute and starts with the period now running, so nothing is reset at once.",
    errInput: "Not saved: invalid input.",
    errConfirm: "Not saved: please confirm that the rankings will be reset regularly.",
    cli: "From the console: gamewe halloffame schedule -all [EVERY|off] -mode MODE",
  },
};

// The reset schedule for all rankings (admins only).
export async function GlobalHallCard({ lang, status, rankings }: { lang: Lang; status?: string; rankings: { code: string; name: string }[] }) {
  const t = T[lang === "de" ? "de" : "en"];
  const ht = hallT(lang);
  const [g, following] = await Promise.all([globalHall(), inheritingRankings(rankings.map((r) => r.code))]);
  const msg = { saved: t.saved, input: t.errInput, confirm: t.errConfirm }[status ?? ""];
  const names = rankings.filter((r) => following.includes(r.code));
  return (
    <section className="card" id="hall-of-fame">
      <header>
        <h2>{t.title}</h2>
      </header>
      {msg ? <p className={status === "saved" ? "notice" : "notice error"}>{msg}</p> : null}
      <form action={globalHallAction} className="form box hof-form">
        <p>{t.intro}</p>
        <HallScheduleFields lang={lang} schedule={g.schedule} mode={g.mode} withOff />
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
        <label className="check">
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

import Link from "next/link";
import { notFound } from "next/navigation";
import { hallEntryAction } from "../../../../actions";
import { PageHead } from "@/components/admin/page-head";
import { hallEntries, hallSettings } from "@/lib/admin-hall";
import { adminDict } from "@/lib/admin-i18n";
import { rankingSummaries } from "@/lib/admin-rankings";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { basePath } from "@/lib/base-path";
import { localeOf } from "@/lib/format";
import { periodLabel, podium, type HallUnit } from "@/lib/hall-period";
import { getAdminLang } from "@/lib/i18n";

const T = {
  de: {
    title: "Ruhmeshalle bearbeiten",
    intro:
      "Hier lassen sich Einträge aus der Ruhmeshalle nehmen, z. B. einen Cheater. Die Spieler darunter rücken nach: Der Collector speichert die besten fünf (bis Version 0.19 drei), auf dem Podest stehen die ersten drei, die nicht entfernt und nicht versteckt sind. Gibt es weniger, bleibt der Platz leer. Die Sterne werden danach neu gezählt. Entfernte Einträge bleiben gespeichert und lassen sich zurückholen.",
    old: "Der Collector ist noch nicht aktualisiert: Einträge lassen sich erst entfernen, wenn gamewe db migrate die Spalte removed angelegt hat (Collector-Migration 16).",
    empty: "Noch keine Einträge.",
    stored: "Gespeichert",
    shown: "Podest",
    player: "Spieler",
    then: "damals",
    skill: "Punkte",
    kills: "Kills",
    status: "Status",
    removedPill: "entfernt",
    hiddenPill: "versteckt",
    reserve: "Nachrücker",
    remove: "Entfernen",
    removeSure: "Ja, entfernen",
    restore: "Zurückholen",
    removeAll: "Ganze Periode entfernen",
    removeAllSure: "Ja, alle Einträge dieser Periode entfernen",
    restoreAll: "Ganze Periode zurückholen",
    removed: "Entfernt. Die anderen sind nachgerückt.",
    restored: "Zurückgeholt.",
    errInput: "Ungültige Eingabe.",
    errConfirm: "Bitte das Entfernen bestätigen.",
    view: "Ruhmeshalle ansehen",
    settings: "Zeitplan",
    week: "KW {n}",
  },
  en: {
    title: "Edit hall of fame",
    intro:
      "Take entries out of the hall of fame here, e.g. a cheater. The players below move up: the collector stores the best five (three up to version 0.19), the podium shows the first three that are neither removed nor hidden. With fewer the place stays empty. Stars are counted again. Removed entries stay stored and can be brought back.",
    old: "The collector is not updated yet: entries can be removed once gamewe db migrate has added the column removed (collector migration 16).",
    empty: "No entries yet.",
    stored: "Stored",
    shown: "Podium",
    player: "Player",
    then: "then",
    skill: "Points",
    kills: "Kills",
    status: "Status",
    removedPill: "removed",
    hiddenPill: "hidden",
    reserve: "reserve",
    remove: "Remove",
    removeSure: "Yes, remove",
    restore: "Bring back",
    removeAll: "Remove whole period",
    removeAllSure: "Yes, remove all entries of this period",
    restoreAll: "Bring back whole period",
    removed: "Removed. The others moved up.",
    restored: "Brought back.",
    errInput: "Invalid input.",
    errConfirm: "Please confirm the removal.",
    view: "View hall of fame",
    settings: "Schedule",
    week: "Week {n}",
  },
};

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
  const t = T[lang === "de" ? "de" : "en"];
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
            <Link className="button" href={`${back}#hall-of-fame`}>
              {t.settings}
            </Link>
            <a className="button" href={`${basePath}/${encodeURIComponent(code)}/hall-of-fame`} target="_blank" rel="noopener">
              {t.view}
            </a>
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
                          <Link className="name" href={`/admin/players/${e.playerId}`}>
                            {e.currentName}
                          </Link>
                        ) : (
                          <span className="name">{e.name}</span>
                        )}
                        {e.currentName && e.currentName !== e.name ? (
                          <span className="subt">
                            {" "}
                            {t.then}: {e.name}
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

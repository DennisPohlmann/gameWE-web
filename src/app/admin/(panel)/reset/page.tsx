import Link from "next/link";
import { resetRankingAction } from "../../actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { ResetForm } from "@/components/reset-form";
import { SortableTable } from "@/components/sortable-table";
import { Section, TableWrap } from "@/components/ui";
import { resettableRankings } from "@/lib/admin-rankings";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { getAdminLang } from "@/lib/i18n";
import { shortDuration } from "@/lib/job-plan";
import { RESET_MODES, collectorRunning, getJob, jobModeName, jobsAvailable, recentJobs, type ResetJob, type ResetMode } from "@/lib/reset";

const T = {
  de: {
    title: "Ranking zurücksetzen",
    intro:
      "Setzt eine Rangliste zurück. Spiele, Server, Waffen-, Aktions- und Award-Definitionen sowie die Einstellungen bleiben erhalten. Das lässt sich nicht rückgängig machen; vorher ein Backup der Datenbank machen.",
    how: "Die Webseite gibt nur den Auftrag; der Collector führt ihn aus. Er pausiert dafür kurz die Server dieser Rangliste, der Collector muss nicht gestoppt werden. Auf der Konsole geht es auch: gamewe reset KÜRZEL -mode player-stats|all-stats|all",
    missing:
      "Diese Funktion braucht Collector 0.1.0 oder neuer und eine Datenbank aus dessen Init-Skript (Tabelle hlstats_gamewe_jobs). Bis dahin: auf der Konsole mit dem Collector zurücksetzen.",
    version: "Die drei Arten brauchen Collector 0.2.0 oder neuer; ein älterer lehnt den Auftrag ab, ohne etwas zu ändern.",
    templates: "Vorlagen (Rankings ohne Server) stehen nicht zur Wahl: Sie enthalten nur die Definitionen für neue Rankings und werden nie zurückgesetzt.",
    noRankings: "Es gibt noch kein Ranking mit Servern, also nichts zurückzusetzen.",
    ranking: "Rangliste",
    mode: "Was zurücksetzen?",
    modes: {
      "player-stats": {
        title: "Nur Spielerstatistiken",
        deletes:
          "Löscht Ereignisse, Spieler-Verläufe, Waffen-, Aktions-, Karten-, Rollen- und Team-Statistiken der Spieler und die Award-Gewinner; die Spieler starten wieder mit den Startpunkten (Einstellungen → Punkte).",
        keeps: "Spieler, Namen, Steam-IDs, Clans und die Serverstatistiken bleiben.",
      },
      "all-stats": {
        title: "Alle Statistiken",
        deletes:
          "Löscht alle Spielerstatistiken und dazu die Serverstatistiken: Zähler der Server (Kills, Spieler, Runden, Headshots, Bomben, Siege, Karten-Werte), den Lastverlauf und den Trend.",
        keeps: "Spieler, Namen, Steam-IDs und Clans bleiben.",
      },
      all: {
        title: "Alles",
        deletes: "Löscht alle Spieler- und Serverstatistiken und dazu alle Spieler, Namen, Steam-IDs und Clans dieser Rangliste.",
        keeps: "Spiele, Server und Definitionen bleiben.",
      },
    } as Record<ResetMode, { title: string; deletes: string; keeps: string }>,
    submit: "Zurücksetzen …",
    dialogTitle: "Ranking endgültig zurücksetzen?",
    dialogRanking: "Rangliste",
    dialogMode: "Art",
    dialogDeletes: "Wird gelöscht",
    dialogKeeps: "Bleibt erhalten",
    understood: "Mir ist klar, dass diese Daten unwiderruflich gelöscht werden.",
    confirm: "Endgültig zurücksetzen",
    cancel: "Abbrechen",
    noCollector: "Der Collector läuft gerade nicht. Der Auftrag wird beim nächsten Start ausgeführt.",
    lastBeat: "Letztes Lebenszeichen (gamewe_heartbeat) vor {a}, um {t} (Uhr des Web-Servers: {n}).",
    noBeat: "Es gibt noch kein Lebenszeichen (gamewe_heartbeat) in der Datenbank.",
    existing: "Für diese Rangliste wartet schon ein Auftrag; es wird kein zweiter angelegt.",
    job: "Auftrag {i}: {g} ({m})",
    pending: "Wartet auf den Collector …",
    running: "Läuft …",
    done: "Erledigt.",
    failed: "Fehlgeschlagen.",
    unknown: "Auftrag nicht gefunden.",
    errConfirm: "Nicht zurückgesetzt: Das Zurücksetzen wurde im Dialog nicht bestätigt.",
    errInput: "Nicht zurückgesetzt: Rangliste oder Art fehlt.",
    errDb: "Der Auftrag konnte nicht angelegt werden. Details stehen im Log der Webseite.",
    recent: "Letzte Aufträge",
    colId: "Nr.",
    colGame: "Rangliste",
    colMode: "Art",
    colStatus: "Status",
    colBy: "Von",
    colAt: "Angelegt",
    colResult: "Ergebnis",
  },
  en: {
    title: "Reset ranking",
    intro:
      "Resets one ranking. Games, servers, weapon, action and award definitions and the settings stay. This cannot be undone; back up the database first.",
    how: "The website only places the job; the collector runs it. It briefly pauses the servers of that ranking, so the collector does not have to be stopped. From the console: gamewe reset CODE -mode player-stats|all-stats|all",
    missing:
      "This needs collector 0.1.0 or newer and a database created with its init script (table hlstats_gamewe_jobs). Until then, reset from the console with the collector.",
    version: "The three kinds need collector 0.2.0 or newer; an older one refuses the job without changing anything.",
    templates: "Templates (rankings without servers) are not offered: they only hold the definitions for new rankings and are never reset.",
    noRankings: "There is no ranking with servers yet, so there is nothing to reset.",
    ranking: "Ranking",
    mode: "What to reset?",
    modes: {
      "player-stats": {
        title: "Player statistics only",
        deletes:
          "Deletes the events, player histories, the players' weapon, action, map, role and team statistics and the award winners; the players start again with the start points (Settings → Points).",
        keeps: "Players, names, Steam IDs, clans and the server statistics stay.",
      },
      "all-stats": {
        title: "All statistics",
        deletes:
          "Deletes all player statistics and the server statistics too: the server counters (kills, players, rounds, headshots, bombs, wins, map values), the load history and the trend.",
        keeps: "Players, names, Steam IDs and clans stay.",
      },
      all: {
        title: "Everything",
        deletes: "Deletes all player and server statistics and also all players, names, Steam IDs and clans of this ranking.",
        keeps: "Games, servers and definitions stay.",
      },
    } as Record<ResetMode, { title: string; deletes: string; keeps: string }>,
    submit: "Reset …",
    dialogTitle: "Reset the ranking for good?",
    dialogRanking: "Ranking",
    dialogMode: "Kind",
    dialogDeletes: "Deleted",
    dialogKeeps: "Kept",
    understood: "I understand that this data will be deleted irreversibly.",
    confirm: "Reset for good",
    cancel: "Cancel",
    noCollector: "The collector is not running right now. The job runs at its next start.",
    lastBeat: "Last sign of life (gamewe_heartbeat) {a} ago, at {t} (clock of the web server: {n}).",
    noBeat: "There is no sign of life (gamewe_heartbeat) in the database yet.",
    existing: "A job for this ranking is already waiting; no second one was created.",
    job: "Job {i}: {g} ({m})",
    pending: "Waiting for the collector …",
    running: "Running …",
    done: "Done.",
    failed: "Failed.",
    unknown: "Job not found.",
    errConfirm: "Not reset: the reset was not confirmed in the dialog.",
    errInput: "Not reset: ranking or kind missing.",
    errDb: "The job could not be created. See the website log for details.",
    recent: "Recent jobs",
    colId: "No.",
    colGame: "Ranking",
    colMode: "Kind",
    colStatus: "Status",
    colBy: "By",
    colAt: "Created",
    colResult: "Result",
  },
};

function when(ts: number | null, locale: string) {
  return ts ? new Date(ts * 1000).toLocaleString(locale) : "";
}

export default async function ResetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin(LEVEL_ADMIN);
  const lang = await getAdminLang();
  const t = T[lang];
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const sp = await searchParams;
  const f = (s: string, v: Record<string, string>) => s.replace(/\{(\w)\}/g, (_, k) => v[k] ?? "");
  const modeName = (m: string) => {
    const k = jobModeName(m);
    return k ? t.modes[k].title : m;
  };

  if (!(await jobsAvailable())) {
    return (
      <>
        <h1>{t.title}</h1>
        <p className="notice">{t.missing}</p>
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
  const jobs = await recentJobs(10);

  return (
    <>
      <h1>{t.title}</h1>
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
      {jobs.length ? (
        <Section title={t.recent}>
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
              values: [Number(j.id), j.game, modeName(j.mode), j.status, j.requested_by, Number(j.requested_at), null],
              cells: [
                <Link key="id" href={`/admin/reset?job=${j.id}`}>
                  {j.id}
                </Link>,
                j.game,
                modeName(j.mode),
                j.status,
                j.requested_by,
                when(Number(j.requested_at), locale),
                j.result ?? "",
              ],
            }))}
          />
          </TableWrap>
        </Section>
      ) : null}
    </>
  );
}

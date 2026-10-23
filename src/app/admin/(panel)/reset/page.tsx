import Link from "next/link";
import { resetRankingAction } from "../../actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { Section, TableWrap } from "@/components/ui";
import { optionList } from "@/lib/admin-data";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { getAdminLang } from "@/lib/i18n";
import { collectorRunning, getJob, jobsAvailable, recentJobs, type ResetJob } from "@/lib/reset";

const T = {
  de: {
    title: "Ranking zurücksetzen",
    intro:
      "Setzt eine Rangliste zurück. Spiele, Server, Waffen-, Aktions- und Award-Definitionen sowie die Einstellungen bleiben erhalten. Das lässt sich nicht rückgängig machen; vorher ein Backup der Datenbank machen.",
    how: "Die Webseite gibt nur den Auftrag; der Collector führt ihn aus. Er pausiert dafür kurz die Server dieser Rangliste, der Collector muss nicht gestoppt werden. Auf der Konsole geht es auch: gamewe reset KÜRZEL -mode stats|all",
    missing:
      "Diese Funktion braucht Collector 0.1.0 oder neuer und eine Datenbank aus dessen Init-Skript (Tabelle hlstats_gamewe_jobs). Bis dahin: auf der Konsole mit dem Collector zurücksetzen.",
    ranking: "Rangliste",
    mode: "Was zurücksetzen?",
    stats: "Nur Statistiken: Spieler bleiben, starten wieder mit den Startpunkten (Einstellungen → Punkte) und leeren Statistiken",
    all: "Alles: auch alle Spieler, Namen, Steam-IDs und Clans dieser Rangliste löschen",
    confirm: "Zur Bestätigung das Kürzel der Rangliste eintippen",
    submit: "Endgültig zurücksetzen",
    noCollector: "Der Collector läuft gerade nicht. Der Auftrag wird beim nächsten Start ausgeführt.",
    existing: "Für diese Rangliste wartet schon ein Auftrag; es wird kein zweiter angelegt.",
    job: "Auftrag {i}: {g} ({m})",
    pending: "Wartet auf den Collector …",
    running: "Läuft …",
    done: "Erledigt.",
    failed: "Fehlgeschlagen.",
    unknown: "Auftrag nicht gefunden.",
    errConfirm: "Nicht zurückgesetzt: Das Kürzel stimmt nicht.",
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
    how: "The website only places the job; the collector runs it. It briefly pauses the servers of that ranking, so the collector does not have to be stopped. From the console: gamewe reset CODE -mode stats|all",
    missing:
      "This needs collector 0.1.0 or newer and a database created with its init script (table hlstats_gamewe_jobs). Until then, reset from the console with the collector.",
    ranking: "Ranking",
    mode: "What to reset?",
    stats: "Statistics only: players stay and start again with the start points (Settings → Points) and empty statistics",
    all: "Everything: also delete all players, names, Steam IDs and clans of this ranking",
    confirm: "Type the ranking's code to confirm",
    submit: "Reset for good",
    noCollector: "The collector is not running right now. The job runs at its next start.",
    existing: "A job for this ranking is already waiting; no second one was created.",
    job: "Job {i}: {g} ({m})",
    pending: "Waiting for the collector …",
    running: "Running …",
    done: "Done.",
    failed: "Failed.",
    unknown: "Job not found.",
    errConfirm: "Not reset: the code does not match.",
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
  const modeName = (m: string) => (m === "all" ? t.all : t.stats).split(":")[0];

  if (!(await jobsAvailable())) {
    return (
      <>
        <h1>{t.title}</h1>
        <p className="notice">{t.missing}</p>
      </>
    );
  }

  const games = await optionList("games");
  const running = await collectorRunning();
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
          {open && !running ? <p>{t.noCollector}</p> : null}
          {job.result ? <pre className="reset-result">{job.result}</pre> : null}
          {open ? <AutoRefresh seconds={3} /> : null}
        </div>
      ) : null}
      <Section title={t.title}>
        <form action={resetRankingAction} className="form settings-grid">
          <p className="settings-help">{t.intro}</p>
          <p className="settings-help">{t.how}</p>
          {!running ? <p className="settings-help notice error">{t.noCollector}</p> : null}
          <label>
            {t.ranking}
            <select name="game" defaultValue={sp.game ?? ""} required>
              <option value="">-</option>
              {games.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="reset-mode">
            <legend>{t.mode}</legend>
            <label>
              <input type="radio" name="mode" value="stats" defaultChecked /> {t.stats}
            </label>
            <label>
              <input type="radio" name="mode" value="all" /> {t.all}
            </label>
          </fieldset>
          <label>
            {t.confirm}
            <input name="confirm" autoComplete="off" required maxLength={32} />
          </label>
          <div>
            <button type="submit" className="button danger">
              {t.submit}
            </button>
          </div>
        </form>
      </Section>
      {jobs.length ? (
        <Section title={t.recent}>
          <TableWrap>
          <table>
            <thead>
              <tr>
                <th>{t.colId}</th>
                <th>{t.colGame}</th>
                <th>{t.colMode}</th>
                <th>{t.colStatus}</th>
                <th>{t.colBy}</th>
                <th>{t.colAt}</th>
                <th>{t.colResult}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td>
                    <Link href={`/admin/reset?job=${j.id}`}>{j.id}</Link>
                  </td>
                  <td>{j.game}</td>
                  <td>{modeName(j.mode)}</td>
                  <td>{j.status}</td>
                  <td>{j.requested_by}</td>
                  <td>{when(Number(j.requested_at), locale)}</td>
                  <td className="reset-result-cell">{j.result ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableWrap>
        </Section>
      ) : null}
    </>
  );
}

import { scheduleText } from "@/components/admin/hall-schedule";
import { originText, type JobOrigin } from "@/lib/job-origin";

const LABEL = { de: "Ausgelöst von", en: "Started by" };

// The feature that queued a job and why, as one line under the job's name
// (Jobs page, reset page). by: who queued it as the page may show it.
export function JobOriginLine({ origin, requestedBy, by, lang }: { origin: JobOrigin; requestedBy: string; by: string; lang: "de" | "en" }) {
  const o = originText(origin, requestedBy, by, lang, (s) => scheduleText(lang, s));
  return (
    <div className="subt job-origin">
      {LABEL[lang]}: <b>{o.source}</b>
      {o.parts.length ? ` · ${o.parts.join(" · ")}` : null}
    </div>
  );
}

import { scheduleText } from "@/components/admin/hall-schedule";
import { tr } from "@/lib/admin-i18n";
import { ORIGIN_LABEL } from "@/lib/admin-texts";
import { originText, type JobOrigin } from "@/lib/job-origin";
import type { Lang } from "@/lib/i18n";

// The feature that queued a job and why, as one line under the job's name
// (Jobs page, reset page). by: who queued it as the page may show it.
export function JobOriginLine({ origin, requestedBy, by, lang }: { origin: JobOrigin; requestedBy: string; by: string; lang: Lang }) {
  const o = originText(origin, requestedBy, by, lang, (s) => scheduleText(lang, s));
  return (
    <div className="subt job-origin">
      {tr(ORIGIN_LABEL, lang)}: <b>{o.source}</b>
      {o.parts.length ? ` · ${o.parts.join(" · ")}` : null}
    </div>
  );
}

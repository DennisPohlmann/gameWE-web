import { noAutofill } from "@/lib/autofill";
import { MAX_EVERY, type Schedule } from "@/lib/hall-period";
import type { Lang } from "@/lib/i18n";
import { RESET_MODES, type ResetMode } from "@/lib/reset-modes";
import { localized } from "@/lib/admin-i18n";
import { HALL_T } from "@/lib/admin-texts";

// Texts and form fields shared by the hall of fame cards (schedule for all
// rankings, schedule of one ranking). The start-day fields show only for
// their unit (CSS :has, no script); hidden ones are sent too but ignored.

export function hallT(lang: Lang) {
  return localized(HALL_T, lang);
}

// Unit, every N, start day and mode.
export function HallScheduleFields({ lang, schedule, mode }: { lang: Lang; schedule: Schedule | null; mode: ResetMode }) {
  const t = hallT(lang);
  // A schedule of every 3 (6, ...) months is offered as quarters.
  const unit = !schedule ? "month" : schedule.unit === "month" && schedule.every % 3 === 0 ? "quarter" : schedule.unit;
  const every = !schedule ? 1 : unit === "quarter" ? schedule.every / 3 : schedule.every;
  const day = schedule?.day ?? 1;
  const units = ["day", "week", "month", "quarter", "year"] as const;
  return (
    <>
      <label>
        {t.every}
        <span className="hof-every">
          <span>{t.all}</span>
          <input {...noAutofill} type="number" name="every" min={1} max={MAX_EVERY} defaultValue={every} />
          <select {...noAutofill} name="unit" defaultValue={unit}>
            {units.map((u) => (
              <option key={u} value={u}>
                {t.units[u]}
              </option>
            ))}
          </select>
        </span>
        <small>{t.everyHelp}</small>
      </label>
      <label className="hof-anchor hof-mday">
        {t.mday}
        <input {...noAutofill} type="number" name="mday" min={1} max={28} defaultValue={schedule?.unit === "month" ? day : 1} className="hof-num" />
        <small>{t.mdayHelp}</small>
      </label>
      <label className="hof-anchor hof-wday">
        {t.wday}
        <select {...noAutofill} name="wday" defaultValue={schedule?.unit === "week" ? day : 1}>
          {t.wdays.map((d, i) => (
            <option key={d} value={i + 1}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className="hof-anchor hof-ydate">
        {t.ydate}
        <span className="hof-every">
          <input {...noAutofill} type="number" name="yday" min={1} max={28} defaultValue={schedule?.unit === "year" ? day : 1} className="hof-num" />
          <select {...noAutofill} name="ymonth" defaultValue={schedule?.unit === "year" ? schedule.month : 1}>
            {t.months.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </span>
        <small>{t.ydateHelp}</small>
      </label>
      <label className="hof-mode">
        {t.mode}
        <select {...noAutofill} name="mode" defaultValue={mode}>
          {RESET_MODES.map((m) => (
            <option key={m} value={m}>
              {t.modes[m]}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

// "every 2 months from the 15th" for the texts of the cards.
export function scheduleText(lang: Lang, s: Schedule | null): string {
  const t = hallT(lang);
  if (!s) return t.units.off;
  const quarter = s.unit === "month" && s.every % 3 === 0;
  const n = quarter ? s.every / 3 : s.every;
  const unit = quarter ? "quarter" : s.unit;
  const fill = (f: string, v: Record<string, string | number>) => f.replace(/\{(\w)\}/g, (_, k: string) => String(v[k]));
  let v = n === 1 ? t.once[unit] : fill(t.everyN, { n, u: t.units[unit] });
  if ((s.unit === "month" && s.day !== 1) || (s.unit === "year" && (s.day !== 1 || s.month !== 1))) {
    v += ` ${fill(s.unit === "year" ? t.fromDate : t.fromDay, { d: lang === "en" ? ordinal(s.day) : s.day, m: t.months[s.month - 1] })}`;
  } else if (s.unit === "week" && s.day !== 1) {
    v += ` ${fill(t.fromWday, { w: t.wdays[s.day - 1] })}`;
  }
  return v;
}

function ordinal(n: number): string {
  const s = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${s}`;
}

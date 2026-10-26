import { noAutofill } from "@/lib/autofill";
import { MAX_EVERY, type Schedule } from "@/lib/hall-period";
import type { Lang } from "@/lib/i18n";
import { RESET_MODES, type ResetMode } from "@/lib/reset-modes";

// Texts and form fields shared by the hall of fame cards (schedule for all
// rankings, schedule of one ranking). The start-day fields show only for
// their unit (CSS :has, no script); hidden ones are sent too but ignored.

export const HALL_T = {
  de: {
    every: "Reset",
    everyHelp: "Alle N Tage, Wochen, Monate, Quartale oder Jahre, z. B. alle 2 Monate.",
    units: { off: "Aus (kein geplanter Reset)", day: "Tage", week: "Wochen", month: "Monate", quarter: "Quartale", year: "Jahre" },
    all: "alle",
    mday: "Stichtag im Monat",
    mdayHelp: "Die Periode beginnt an diesem Tag (1 bis 28), z. B. jeden 15. Beim Quartal ist es der Tag im ersten Monat des Quartals.",
    wday: "Wochentag",
    wdays: ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
    ydate: "Stichtag im Jahr",
    ydateHelp: "Tag (1 bis 28) und Monat, an dem das Jahr beginnt, z. B. 1. Juli für eine Saison.",
    months: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
    mode: "Was zurücksetzen?",
    modes: { "player-stats": "Nur Spielerstatistiken", "all-stats": "Alle Statistiken", all: "Alles, auch die Spieler" } as Record<ResetMode, string>,
    time: "Die Uhrzeit des Resets steht in der config.yaml des Collectors (features.scheduled_resets.time, Standard 00:00) und gilt in seiner Zeitzone.",
  },
  en: {
    every: "Reset",
    everyHelp: "Every N days, weeks, months, quarters or years, e.g. every 2 months.",
    units: { off: "Off (no scheduled reset)", day: "days", week: "weeks", month: "months", quarter: "quarters", year: "years" },
    all: "every",
    mday: "Start day of the month",
    mdayHelp: "The period starts on this day (1 to 28), e.g. every 15th. For quarters it is the day in the quarter's first month.",
    wday: "Weekday",
    wdays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    ydate: "Start day of the year",
    ydateHelp: "Day (1 to 28) and month the year starts on, e.g. 1 July for a season.",
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    mode: "What to reset?",
    modes: { "player-stats": "Player statistics only", "all-stats": "All statistics", all: "Everything, players too" } as Record<ResetMode, string>,
    time: "The time of the reset is set in the collector's config.yaml (features.scheduled_resets.time, default 00:00), in its time zone.",
  },
};

export function hallT(lang: Lang) {
  return HALL_T[lang === "de" ? "de" : "en"];
}

// Unit, every N, start day and mode. withOff: the unit list starts with "off".
export function HallScheduleFields({ lang, schedule, mode, withOff }: { lang: Lang; schedule: Schedule | null; mode: ResetMode; withOff: boolean }) {
  const t = hallT(lang);
  // A schedule of every 3 (6, ...) months is offered as quarters.
  const unit = !schedule ? (withOff ? "off" : "month") : schedule.unit === "month" && schedule.every % 3 === 0 ? "quarter" : schedule.unit;
  const every = !schedule ? 1 : unit === "quarter" ? schedule.every / 3 : schedule.every;
  const day = schedule?.day ?? 1;
  const units = withOff ? (["off", "day", "week", "month", "quarter", "year"] as const) : (["day", "week", "month", "quarter", "year"] as const);
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
  const de = lang === "de";
  const names = de
    ? { day: ["täglich", "Tage"], week: ["wöchentlich", "Wochen"], month: ["monatlich", "Monate"], quarter: ["vierteljährlich", "Quartale"], year: ["jährlich", "Jahre"] }
    : { day: ["daily", "days"], week: ["weekly", "weeks"], month: ["monthly", "months"], quarter: ["quarterly", "quarters"], year: ["yearly", "years"] };
  const [one, many] = names[quarter ? "quarter" : s.unit];
  let v = n === 1 ? one : `${de ? "alle" : "every"} ${n} ${many}`;
  if ((s.unit === "month" && s.day !== 1) || (s.unit === "year" && (s.day !== 1 || s.month !== 1))) {
    v += de ? ` ab dem ${s.day}.${s.unit === "year" ? ` ${t.months[s.month - 1]}` : ""}` : ` from the ${ordinal(s.day)}${s.unit === "year" ? ` of ${t.months[s.month - 1]}` : ""}`;
  } else if (s.unit === "week" && s.day !== 1) {
    v += de ? ` ab ${t.wdays[s.day - 1]}` : ` from ${t.wdays[s.day - 1]}`;
  }
  return v;
}

function ordinal(n: number): string {
  const s = n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th";
  return `${n}${s}`;
}

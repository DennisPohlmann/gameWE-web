import Link from "next/link";
import { globalHallAction } from "../../actions";
import { HallScheduleFields, hallT, scheduleText } from "@/components/admin/hall-schedule";
import { globalHall, inheritingRankings } from "@/lib/admin-hall";
import { nextStart } from "@/lib/hall-period";
import type { Lang } from "@/lib/i18n";
import { dateFormat, localeOf } from "@/lib/format";
import { localized } from "@/lib/admin-i18n";
import { GLOBAL_HALL_T } from "@/lib/admin-texts";

// The reset schedule for all rankings (admins only), on the reset page next
// to the manual reset; rankings: those with servers, templates are never
// reset.
export async function GlobalHallCard({ lang, status, rankings }: { lang: Lang; status?: string; rankings: { code: string; name: string }[] }) {
  const t = localized(GLOBAL_HALL_T, lang);
  const ht = hallT(lang);
  const codes = rankings.map((r) => r.code);
  const [g, following] = await Promise.all([globalHall(codes), inheritingRankings(codes)]);
  const msg = { on: t.savedOn, off: t.savedOff, input: t.errInput, confirm: t.errConfirm }[status ?? ""];
  const names = rankings.filter((r) => following.includes(r.code));
  const locale = localeOf(lang);
  const date = (d: string) => dateFormat(locale, { timeZone: "UTC" }).format(Date.parse(`${d}T00:00:00Z`));
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
                        <Link prefetch={false} key={r.code} href={`/admin/rankings/${encodeURIComponent(r.code)}#hall-of-fame`}>
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

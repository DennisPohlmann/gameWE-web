import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineChart } from "@/components/chart";
import { ChartHead } from "@/components/chart-head";
import { GameEventsList } from "@/components/game-events-list";
import { sortHeads, SortInputs } from "@/components/sort-head";
import { Empty, Pager, PctBar, ROW_OPTIONS, Section, pageParam, rowsParam, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { getPlayerFlags } from "@/lib/data";
import { eventsListLive } from "@/lib/events-mode";
import { EVENT_GROUPS, EVENT_PERIODS, FILTER_KINDS, MAX_LIST_ROWS, eventShares, eventStats, kindsOf, periodParam, periodRange, typeParam } from "@/lib/events-page";
import { dateFormat, fmtNum, localeOf, nowUnix, siteTimeZone } from "@/lib/format";
import { getGameEventCounts, getGameEventList, hasEventServer } from "@/lib/history";
import { fill, getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { sortState, timeSorts } from "@/lib/table-sort";

type Props = { params: Promise<{ game: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.events };
}

// Colour of each group's line, also on the swatch of its types in the
// share table.
const GROUP_CLASS = Object.fromEntries(EVENT_GROUPS.map((g, i) => [g.id, `s${i + 1}`])) as Record<(typeof EVENT_GROUPS)[number]["id"], string>;
const TYPE_CLASS = Object.fromEntries(EVENT_GROUPS.flatMap((g) => g.kinds.map((k) => [k, GROUP_CLASS[g.id]]))) as Record<string, string>;

// All events of a ranking (the kinds of the start page's box) over the last
// hour, 24 hours or 7 days: a chart of the events over time per group, the
// share of each type, and the list with a type filter and a pager. Follows
// the setting "Latest events (ranking start page)": "Sync" lets new events
// run in on the first page, "Async" is a plain list, "Off": no page (404)
// and no tab.
export default async function EventsPage({ params, searchParams }: Props) {
  const { game } = await params;
  const sp = await searchParams;
  const { pageSize, gameEvents } = await getSettings();
  if (gameEvents === "off") notFound();
  const { lang, t } = await getDict();
  const limit = rowsParam(sp.rows, pageSize);
  const period = periodParam(strParam(sp.period));
  const type = typeParam(strParam(sp.type));
  const kinds = kindsOf(type);
  const order = sortState(sp, timeSorts, "date");
  const { from, step, n } = periodRange(period, nowUnix());

  const stats = eventStats(await getGameEventCounts(game, from, step), n);
  const total = type ? stats.byType[type] : stats.total;
  const shownTotal = Math.min(total, MAX_LIST_ROWS);
  const pages = Math.max(1, Math.ceil(shownTotal / limit));
  const page = Math.min(pageParam(sp.page), pages);
  const [rows, withServer] = await Promise.all([getGameEventList(game, kinds, from, limit, (page - 1) * limit, order.asc), hasEventServer()]);
  const flags = await getPlayerFlags(rows.flatMap((r) => [r.actor, r.other]));

  const base = `/${game}/events`;
  const keep = {
    period: period !== "24h" ? period : undefined,
    type: type || undefined,
    ...order.keep,
    rows: limit !== pageSize ? limit : undefined,
  };
  const th = sortHeads(order, base, keep);
  const href = (p: Record<string, string | number | undefined>) => {
    const q = new URLSearchParams(Object.entries({ ...keep, ...p }).flatMap(([k, v]) => (v === undefined ? [] : [[k, String(v)]])));
    return q.size ? `${base}?${q}` : base;
  };

  // Live like the box on the start page (setting "Sync"); the feed keeps the
  // type filter and the period.
  const live = eventsListLive(gameEvents, page, order.asc);
  const feed = `/${encodeURIComponent(game)}/events-feed?list=${type}&period=${period}`;

  // Chart: hours as "14:00" with the day below (24 hours, 7 days), or the
  // time of each 5 minutes (last hour); the hover box names the full time.
  const locale = localeOf(lang);
  const at = (i: number) => (from + i * step) * 1000;
  const tipFmt = dateFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const dateFmt = dateFormat(locale, { weekday: "short", day: "2-digit", month: "2-digit" });
  const timeFmt = dateFormat(locale, { hour: "2-digit", minute: "2-digit" });
  const steps = Array.from({ length: n }, (_, i) => i);
  const hourly = step >= 3_600;
  // Last hour: a time (and a line) every quarter hour.
  const labels = steps.map((i) => (hourly ? `${String(new Date(at(i)).getHours()).padStart(2, "0")}:00` : new Date(at(i)).getMinutes() % 15 === 0 ? timeFmt.format(at(i)) : ""));
  const shares = eventShares(stats);
  const totalText = fill(t.eventsTotal, { n: fmtNum(stats.total, lang) });

  return (
    <Section title={t.events}>
      <GameEventsList
        key={`${type}|${period}|${page}|${order.asc}|${limit}`}
        toolbar={
          <Form className="search" action={base}>
            <SortInputs keep={order.keep} />
            {limit !== pageSize ? <input type="hidden" name="rows" value={limit} /> : null}
            <select {...noAutofill} name="period" defaultValue={period} aria-label={t.period}>
              {(Object.keys(EVENT_PERIODS) as (keyof typeof EVENT_PERIODS)[]).map((p) => (
                <option key={p} value={p}>
                  {t.periods[p]}
                </option>
              ))}
            </select>
            <select {...noAutofill} name="type" defaultValue={type} aria-label={t.eventType}>
              <option value="">{t.allTypes}</option>
              {FILTER_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t.evKind[k]}
                </option>
              ))}
            </select>
            <button type="submit">{t.filter}</button>
          </Form>
        }
        head={
          <tr>
            {th(t.time, "date", "")}
            <th className="hide-sm">{t.eventType}</th>
            <th>{t.eventText}</th>
            {withServer ? <th className="hide-sm">{t.server}</th> : null}
            <th className="hide-sm">{t.map}</th>
          </tr>
        }
        empty={<Empty>{t.noData}</Empty>}
        feed={feed}
        shown={limit}
        game={game}
        lang={lang}
        timeZone={siteTimeZone()}
        live={live}
        withServer={withServer}
        initial={rows}
        initialFlags={Object.fromEntries(flags)}
        labels={{ liveUpdates: t.liveUpdates, evText: t.evText, evKind: t.evKind }}
      >
        {stats.total ? (
          <div className="box events-charts">
            <LineChart
              locale={lang}
              width={640}
              height={200}
              title={t.eventsOverTime}
              ariaLabel={`${t.eventsOverTime}: ${t.periods[period]}`}
              labels={labels}
              dates={hourly ? steps.map((i) => dateFmt.format(at(i))) : undefined}
              tips={steps.map((i) => tipFmt.format(at(i)))}
              hourly={hourly}
              sparseLabels={!hourly}
              trimStart={false}
              series={EVENT_GROUPS.filter((g) => g.kinds.some((k) => stats.byType[k === "playeraction" ? "action" : k] > 0)).map((g) => ({
                label: t.evGroup[g.id],
                values: stats.series[g.id],
                className: GROUP_CLASS[g.id],
              }))}
            />
            <figure className="event-shares">
              <ChartHead title={t.eventShares} note={totalText} series={[]} />
              <table className="event-share-table">
                <tbody>
                  {shares.map((s) => (
                    <tr key={s.type} className={s.type === type ? "active" : undefined}>
                      <td>
                        <i className={`swatch ${TYPE_CLASS[s.type]}`} aria-hidden="true" />{" "}
                        <Link prefetch={false} href={href({ type: s.type === type ? undefined : s.type, page: undefined })} aria-current={s.type === type ? "true" : undefined}>
                          {t.evKind[s.type]}
                        </Link>
                      </td>
                      <td className="num">{fmtNum(s.n, lang)}</td>
                      <td className="barcell">
                        <PctBar value={s.share} lang={lang} tone="share" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </figure>
          </div>
        ) : null}
      </GameEventsList>
      {total > MAX_LIST_ROWS ? <p className="small muted">{fill(t.eventsCapped, { n: fmtNum(MAX_LIST_ROWS, lang), total: fmtNum(total, lang) })}</p> : null}
      {rows.length ? (
        <Pager base={base} params={keep} page={page} pages={pages} total={total} rows={{ value: limit, options: ROW_OPTIONS }} locale={locale} labels={t} />
      ) : null}
    </Section>
  );
}

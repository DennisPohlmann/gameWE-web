import type { Metadata } from "next";
import Form from "next/form";
import { HistoryFrame, loadHistoryPlayer } from "@/components/player-history";
import { PlayerEventsLive } from "@/components/player-events-live";
import { Empty, Pager, ROW_OPTIONS, pageParam, rowsParam, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { localeOf } from "@/lib/format";
import { getPlayerFlags } from "@/lib/data";
import { EVENT_KINDS, countPlayerEvents, getPlayerEvents, type EventKind } from "@/lib/history";
import { sortHeads, SortInputs } from "@/components/sort-head";
import { sortState, timeSorts } from "@/lib/table-sort";
import { eventsListLive } from "@/lib/events-mode";
import { getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.playerHistory}: ${t.histEvents}` };
}

export default async function EventsPage({ params, searchParams }: Props) {
  const { game, id } = await params;
  const sp = await searchParams;
  const p = await loadHistoryPlayer(game, id, "events");
  const { lang, t } = await getDict();
  const { pageSize, playerEvents } = await getSettings();
  const limit = rowsParam(sp.rows, pageSize);
  const page = pageParam(sp.page);
  const type = strParam(sp.type) as EventKind;
  const kinds = EVENT_KINDS.includes(type) ? [type] : [...EVENT_KINDS];
  const order = sortState(sp, timeSorts, "date");
  const [rows, total] = await Promise.all([getPlayerEvents(p.playerId, kinds, limit, (page - 1) * limit, order.asc), countPlayerEvents(p.playerId, kinds)]);
  const flags = await getPlayerFlags(rows.map((r) => r.other));
  const base = `/${game}/players/${p.playerId}/events`;
  const keep = { type: kinds.length === 1 ? type : undefined, ...order.keep, rows: limit !== pageSize ? limit : undefined };
  const th = sortHeads(order, base, keep);

  // Live like the box on the player page (setting "Sync"), switched on by
  // the visitor; the feed keeps the type filter.
  const live = eventsListLive(playerEvents, page, order.asc);
  const feed = `/${encodeURIComponent(game)}/players/${p.playerId}/events-feed?list=${kinds.length === 1 ? type : ""}`;

  return (
    <HistoryFrame game={game} id={p.playerId} name={p.name} t={t} tab="events">
      <PlayerEventsLive
        toolbar={
          <Form className="search" action={base}>
            <SortInputs keep={order.keep} />
            <select {...noAutofill} name="type" defaultValue={kinds.length === 1 ? type : ""} aria-label={t.eventType}>
              <option value="">{t.allTypes}</option>
              {EVENT_KINDS.filter((k) => k !== "playeraction").map((k) => (
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
            <th>{t.eventType}</th>
            <th>{t.eventText}</th>
            <th className="hide-sm">{t.map}</th>
          </tr>
        }
        empty={<Empty>{t.noData}</Empty>}
        feed={feed}
        shown={limit}
        game={game}
        lang={lang}
        live={live}
        initial={rows.slice(0, limit)}
        initialFlags={Object.fromEntries(flags)}
        labels={{ liveUpdates: t.liveUpdates, evText: t.evText, evKind: t.evKind }}
      />
      {rows.length ? (
        <Pager base={base} params={keep} page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
      ) : null}
    </HistoryFrame>
  );
}

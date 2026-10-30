"use client";

import type { ReactNode } from "react";
import { GameEventText, LiveSwitch, keyOf, useLiveRows, useLiveSwitch, type Flags } from "@/components/game-events-live";
import { GameIcon, TableWrap } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { GameEvent } from "@/lib/history";
import type { Lang } from "@/translations/languages";

type Labels = { liveUpdates: string; evText: Record<string, string>; evKind: Record<string, string> };

// The events page of a ranking: the filter bar with the live switch on the
// right, the charts (`children`) and the table of events. Live (setting
// "Latest events (ranking start page)" is "Sync", first page, newest
// first): new events of the filtered type run in at the top, from `feed`,
// as in the box on the start page; the switch starts on and is kept per
// browser. Otherwise a plain table.
export function GameEventsList({
  toolbar,
  head,
  empty,
  feed,
  shown,
  game,
  lang,
  timeZone,
  live,
  withServer,
  serverGame,
  initial,
  initialFlags,
  labels,
  children,
}: {
  // The filter form.
  toolbar: ReactNode;
  // The table's header row (sort links).
  head: ReactNode;
  // Shown instead of the table without rows.
  empty: ReactNode;
  // Path of the JSON feed below the base path.
  feed: string;
  shown: number;
  game: string;
  lang: Lang;
  // The server's time zone (siteTimeZone), so the times hydrate as sent.
  timeZone: string;
  live: boolean;
  withServer: boolean;
  // The ranking's base game: its icon stands before the server names.
  serverGame?: string | null;
  initial: GameEvent[];
  initialFlags: Flags;
  labels: Labels;
  // Between the bar and the table: the charts.
  children?: ReactNode;
}) {
  const { on, toggle, resumed } = useLiveSwitch("gamewe-live-events-page");
  const { rows, flags, fresh } = useLiveRows({ feed, running: live && on, resumed, shown, initial, initialFlags, key: keyOf });
  return (
    <>
      <div className="events-bar">
        {toolbar}
        {live ? <LiveSwitch on={on} toggle={toggle} label={labels.liveUpdates} /> : null}
      </div>
      {children}
      {rows.length ? (
        <TableWrap>
          <table className={`game-events game-events-page${live ? " live" : ""}`}>
            <thead>{head}</thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className={`ev-${e.kind}${e.id === fresh ? " ev-new" : ""}`}>
                  <td className="muted nowrap ev-time">{fmtDateTime(e.ts, lang, timeZone)}</td>
                  <td className="nowrap hide-sm">{labels.evKind[e.kind]}</td>
                  <td className="wrap-cell">
                    <GameEventText e={e} game={game} flags={flags} evText={labels.evText} />
                  </td>
                  {withServer ? <td className="hide-sm muted ev-name">{e.server ? <><GameIcon realgame={serverGame} />{e.server}</> : "-"}</td> : null}
                  <td className="hide-sm muted ev-name">{e.map ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        empty
      )}
    </>
  );
}

"use client";

import type { ReactNode } from "react";
import { LiveSwitch, useLiveRows, useLiveSwitch, type Flags } from "@/components/game-events-live";
import { PlayerLink, TableWrap } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import type { PlayerEventRow } from "@/lib/history";
import type { Lang } from "@/translations/languages";

type Labels = { liveUpdates: string; evText: Record<string, string>; evKind: Record<string, string> };

const keyOf = (e: PlayerEventRow) => `${e.ts}-${e.kind}-${e.other}-${e.num}-${e.text}-${e.code}`;

// The table of the player's events page. Live (admin setting "Latest events
// (player page)" is "Sync", first page, newest first): a switch like the one
// of the live box on the player page, but off on every visit, so the list
// holds still until it is switched on; then new events of the filtered type
// run in at the top, from `feed`. Otherwise a plain table.
export function PlayerEventsLive({
  toolbar,
  head,
  empty,
  feed,
  shown,
  game,
  lang,
  timeZone,
  live,
  initial,
  initialFlags,
  labels,
}: {
  // The filter form, with the switch on the right.
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
  initial: PlayerEventRow[];
  initialFlags: Flags;
  labels: Labels;
}) {
  const { on, toggle, resumed } = useLiveSwitch();
  const { rows, flags, fresh } = useLiveRows({ feed, running: live && on, resumed, shown, initial, initialFlags, key: keyOf });
  const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
  // The sentence of an event, with the other player as a link ("?" for a
  // hidden one).
  const text = (e: PlayerEventRow): ReactNode => {
    const [before, after] = fill(labels.evText[e.kind] ?? "", { x: e.text || e.code || "?", n: e.num, old: e.text, new: e.code, p: "\u0000" }).split("\u0000");
    const hs = (e.kind === "kill" || e.kind === "death") && e.num ? <span className="hs" title="Headshot">HS</span> : null;
    return (
      <>
        {before}
        {after !== undefined ? e.other ? <PlayerLink game={game} id={e.other} name={e.otherName} flag={flags[e.other]} /> : "?" : null}
        {after}
        {hs ? <> {hs}</> : null}
      </>
    );
  };
  return (
    <>
      <div className="events-bar">
        {toolbar}
        {live ? <LiveSwitch on={on} toggle={toggle} label={labels.liveUpdates} /> : null}
      </div>
      {rows.length ? (
        <TableWrap>
          <table className={`player-events${live ? " live" : ""}`}>
            <thead>{head}</thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className={`ev-${e.kind}${e.id === fresh ? " ev-new" : ""}`}>
                  <td className="muted nowrap">{fmtDateTime(e.ts, lang, timeZone)}</td>
                  <td>{labels.evKind[e.kind]}</td>
                  <td className="wrap-cell">{text(e)}</td>
                  <td className="hide-sm muted">{e.map ?? "-"}</td>
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

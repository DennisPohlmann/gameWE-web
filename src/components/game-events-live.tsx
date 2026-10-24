"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PlayerLink, TableWrap } from "@/components/ui";
import { basePath } from "@/lib/base-path";
import { fmtDateTime } from "@/lib/format";
import type { GameEvent } from "@/lib/history";
import type { Lang } from "@/translations/languages";

type Flags = Record<number, { flag: string; country: string; nolink?: boolean }>;
type Labels = { time: string; eventText: string; server: string; map: string; noData: string; evText: Record<string, string> };

const POLL_MS = 4_000;
const SHOWN = 10;
const keyOf = (e: GameEvent) => `${e.ts}-${e.kind}-${e.actor}-${e.other}-${e.code}`;
// Two events can be identical (same second, player and action), so every
// row gets its own id; a shared React key left stale rows behind.
type Row = GameEvent & { id: number };
let seq = 0;
const withId = (e: GameEvent): Row => ({ ...e, id: ++seq });

// The event table of a ranking's start page. Live: while the page is
// visible it asks for new events every few seconds and lets them run in
// at the top one after another, spread over the time until the next ask.
export function GameEventsLive({
  game,
  lang,
  live,
  withServer,
  initial,
  initialFlags,
  labels,
}: {
  game: string;
  lang: Lang;
  live: boolean;
  withServer: boolean;
  initial: GameEvent[];
  initialFlags: Flags;
  labels: Labels;
}) {
  const [data, setData] = useState<{ rows: Row[]; flags: Flags; fresh: number }>(() => ({ rows: initial.slice(0, SHOWN).map(withId), flags: initialFlags, fresh: 0 }));
  const queue = useRef<GameEvent[]>([]);
  const known = useRef(new Set(initial.map(keyOf)));
  const newest = useRef(initial.reduce((m, e) => Math.max(m, e.ts), 0));
  useEffect(() => {
    if (!live) return;
    let drip: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      const e = queue.current.shift();
      if (!e) return;
      newest.current = Math.max(newest.current, e.ts);
      const row = withId(e);
      setData((d) => ({ rows: [row, ...d.rows].slice(0, SHOWN), flags: d.flags, fresh: row.id }));
      if (queue.current.length) drip = setTimeout(next, Math.max(250, Math.min(1500, POLL_MS / (queue.current.length + 1))));
    };
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`${basePath}/${encodeURIComponent(game)}/events-feed`, { cache: "no-store" });
        if (!r.ok) return;
        const j: { rows: GameEvent[]; flags: Flags } = await r.json();
        // Only events at least as new as the newest one shown (or queued)
        // run in, oldest first, so the newest ends up on top. Older ones
        // that only now enter the window (e.g. after hidden players were
        // filtered out) are not new and stay out.
        const top = Math.max(newest.current, ...queue.current.map((e) => e.ts));
        const add = j.rows.filter((e) => e.ts >= top && !known.current.has(keyOf(e))).sort((a, b) => a.ts - b.ts);
        if (!add.length) return;
        for (const e of add) known.current.add(keyOf(e));
        if (known.current.size > 500) known.current = new Set(j.rows.map(keyOf));
        // After a long pause (hidden tab) only the latest ones run in.
        queue.current = [...queue.current, ...add].slice(-SHOWN);
        setData((d) => ({ ...d, flags: { ...d.flags, ...j.flags } }));
        clearTimeout(drip);
        next();
      } catch {}
    };
    const id = setInterval(load, POLL_MS);
    return () => {
      clearInterval(id);
      clearTimeout(drip);
    };
  }, [game, live]);
  const { rows, flags, fresh } = data;
  const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
  const text = (e: GameEvent): ReactNode => {
    const [before, after] = fill(labels.evText[e.kind] ?? "", { x: e.text || e.code || "?", n: e.num, old: e.text, new: e.code, p: "\u0000" }).split("\u0000");
    return (
      <>
        <PlayerLink game={game} id={e.actor} name={e.actorName} flag={flags[e.actor]} /> <span className="ev-verb">{before}</span>
        {after !== undefined ? e.other ? <PlayerLink game={game} id={e.other} name={e.otherName} flag={flags[e.other]} /> : "?" : null}
        {after}
        {e.kind === "kill" && e.num ? (
          <>
            {" "}
            <span className="hs" title="Headshot">HS</span>
          </>
        ) : null}
      </>
    );
  };
  if (!rows.length) return <p className="lead">{labels.noData}</p>;
  return (
    <TableWrap>
      {/* Time as wide as its text, event takes the rest, server and map in full. */}
      <table className={`game-events${live ? " live" : ""}`}>
        <thead>
          <tr>
            <th>{labels.time}</th>
            <th>{labels.eventText}</th>
            {withServer ? <th className="hide-sm">{labels.server}</th> : null}
            <th className="hide-sm">{labels.map}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className={`ev-${e.kind}${e.id === fresh ? " ev-new" : ""}`}>
              <td className="muted nowrap ev-time">{fmtDateTime(e.ts, lang)}</td>
              <td className="wrap-cell">{text(e)}</td>
              {withServer ? (
                <td className="hide-sm muted ev-name">{e.server || "-"}</td>
              ) : null}
              <td className="hide-sm muted ev-name">{e.map ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PlayerLink, Section, TableWrap } from "@/components/ui";
import { basePath } from "@/lib/base-path";
import { fmtDateTime } from "@/lib/format";
import type { GameEvent } from "@/lib/history";
import type { Lang } from "@/translations/languages";

type Flags = Record<number, { flag: string; country: string; nolink?: boolean }>;
type Labels = { time: string; eventText: string; server: string; map: string; noData: string; liveData: string; liveUpdates: string; evText: Record<string, string> };

const POLL_MS = 4_000;
const keyOf = (e: GameEvent) => `${e.ts}-${e.kind}-${e.actor}-${e.other}-${e.code}`;
// Two events can be identical (same second, player and action), so every
// row gets its own id; a shared React key left stale rows behind.
type Row = GameEvent & { id: number };
let seq = 0;
const withId = (e: GameEvent): Row => ({ ...e, id: ++seq });

// The latest events of a ranking's start page or of one player (player
// page), in a section of its own. Live: while the page is visible it asks
// `feed` for new events every few seconds and lets them run in at the top
// one after another, spread over the time until the next ask. Then the
// heading says "(Live data)" and a switch on the right pauses the updates
// (no requests while paused; kept per browser under `pauseKey`).
export function GameEventsLive({
  title,
  feed,
  pauseKey,
  shown,
  game,
  lang,
  live,
  withServer,
  initial,
  initialFlags,
  labels,
}: {
  title: ReactNode;
  // Path of the JSON feed below the base path, e.g. "/cstrike/events-feed".
  feed: string;
  pauseKey: string;
  shown: number;
  game: string;
  lang: Lang;
  live: boolean;
  withServer: boolean;
  initial: GameEvent[];
  initialFlags: Flags;
  labels: Labels;
}) {
  const [data, setData] = useState<{ rows: Row[]; flags: Flags; fresh: number }>(() => ({ rows: initial.slice(0, shown).map(withId), flags: initialFlags, fresh: 0 }));
  const queue = useRef<GameEvent[]>([]);
  const known = useRef(new Set(initial.map(keyOf)));
  const newest = useRef(initial.reduce((m, e) => Math.max(m, e.ts), 0));
  const [on, setOn] = useState(true);
  const resumed = useRef(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(pauseKey) === "off") setOn(false);
    } catch {}
  }, [pauseKey]);
  const toggle = () => {
    resumed.current = !on;
    setOn(!on);
    try {
      if (on) localStorage.setItem(pauseKey, "off");
      else localStorage.removeItem(pauseKey);
    } catch {}
  };
  const running = live && on;
  useEffect(() => {
    if (!running) return;
    let drip: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      const e = queue.current.shift();
      if (!e) return;
      newest.current = Math.max(newest.current, e.ts);
      const row = withId(e);
      setData((d) => ({ rows: [row, ...d.rows].slice(0, shown), flags: d.flags, fresh: row.id }));
      if (queue.current.length) drip = setTimeout(next, Math.max(250, Math.min(1500, POLL_MS / (queue.current.length + 1))));
    };
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`${basePath}${feed}`, { cache: "no-store" });
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
        queue.current = [...queue.current, ...add].slice(-shown);
        setData((d) => ({ ...d, flags: { ...d.flags, ...j.flags } }));
        clearTimeout(drip);
        next();
      } catch {}
    };
    // Switched on again: ask right away, then every few seconds.
    if (resumed.current) {
      resumed.current = false;
      void load();
    }
    const id = setInterval(load, POLL_MS);
    return () => {
      clearInterval(id);
      clearTimeout(drip);
    };
  }, [feed, running, shown]);
  const { rows, flags, fresh } = data;
  const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));
  const text = (e: GameEvent): ReactNode => {
    const [before, after] = fill(labels.evText[e.kind] ?? "", { x: e.text || e.code || "?", n: e.num, old: e.text, new: e.code, p: "\u0000" }).split("\u0000");
    return (
      <>
        {e.actor ? <PlayerLink game={game} id={e.actor} name={e.actorName} flag={flags[e.actor]} /> : "?"} <span className="ev-verb">{before}</span>
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
  const head = live ? (
    <>
      {title} <span className="live-note">({labels.liveData})</span>
    </>
  ) : (
    title
  );
  const aside = live ? (
    <button type="button" role="switch" aria-checked={on} className="live-switch" onClick={toggle}>
      <span className="live-switch-track" aria-hidden="true" />
      {labels.liveUpdates}
    </button>
  ) : null;
  return (
    <Section title={head} aside={aside}>
      {rows.length ? (
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
      ) : (
        <p className="lead">{labels.noData}</p>
      )}
    </Section>
  );
}

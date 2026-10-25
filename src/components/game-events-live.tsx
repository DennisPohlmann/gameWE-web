"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PlayerLink, Section, TableWrap } from "@/components/ui";
import { basePath } from "@/lib/base-path";
import { fmtDateTime } from "@/lib/format";
import { newerWith, newestOf } from "@/lib/live-feed";
import type { GameEvent } from "@/lib/history";
import type { Lang } from "@/translations/languages";

export type Flags = Record<number, { flag: string; country: string; nolink?: boolean }>;
type Labels = { time: string; eventText: string; server: string; map: string; noData: string; liveData: string; liveUpdates: string; evText: Record<string, string> };

const POLL_MS = 4_000;
const keyOf = (e: GameEvent) => `${e.ts}-${e.kind}-${e.actor}-${e.other}-${e.code}`;
// Two events can be identical (same second, player and action), so every
// row gets its own id; a shared React key left stale rows behind.
type Row<T> = T & { id: number };
let seq = 0;
function withId<T>(e: T): Row<T> {
  return { ...e, id: ++seq };
}

// The pause switch of a live list, kept per browser under `pauseKey`
// ("off" while paused). Without `pauseKey` it is not kept and starts off on
// every visit (events page). `resumed` is set when it is switched on again,
// so the feed is asked right away.
export function useLiveSwitch(pauseKey?: string) {
  const [on, setOn] = useState(!!pauseKey);
  const resumed = useRef(false);
  useEffect(() => {
    if (!pauseKey) return;
    try {
      if (localStorage.getItem(pauseKey) === "off") setOn(false);
    } catch {}
  }, [pauseKey]);
  const toggle = () => {
    resumed.current = !on;
    setOn(!on);
    if (!pauseKey) return;
    try {
      if (on) localStorage.setItem(pauseKey, "off");
      else localStorage.removeItem(pauseKey);
    } catch {}
  };
  return { on, toggle, resumed };
}

export function LiveSwitch({ on, toggle, label }: { on: boolean; toggle: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="live-switch" onClick={toggle}>
      <span className="live-switch-track" aria-hidden="true" />
      {label}
    </button>
  );
}

// The rows of a live list: while `running` and the page is visible it asks
// `feed` for the latest rows every few seconds and lets new ones run in at
// the top one after another, spread over the time until the next ask; at
// most `shown` rows stay. `fresh` is the id of the row that came in last.
export function useLiveRows<T extends { ts: number }>({
  feed,
  running,
  resumed,
  shown,
  initial,
  initialFlags,
  key,
}: {
  feed: string;
  running: boolean;
  resumed: { current: boolean };
  shown: number;
  initial: T[];
  initialFlags: Flags;
  // Identity of an event; a function defined outside the component.
  key: (e: T) => string;
}) {
  const [data, setData] = useState<{ rows: Row<T>[]; flags: Flags; fresh: number }>(() => ({ rows: initial.slice(0, shown).map(withId), flags: initialFlags, fresh: 0 }));
  const queue = useRef<T[]>([]);
  const known = useRef(new Set(initial.map(key)));
  // The second of the newest event known (shown or queued) and how many of
  // that second are known: the feed is asked for anything newer than that.
  const newest = useRef(newestOf(initial));
  useEffect(() => {
    if (!running) return;
    let drip: ReturnType<typeof setTimeout> | undefined;
    const next = () => {
      const e = queue.current.shift();
      if (!e) return;
      const row = withId(e);
      setData((d) => ({ rows: [row, ...d.rows].slice(0, shown), flags: d.flags, fresh: row.id }));
      if (queue.current.length) drip = setTimeout(next, Math.max(250, Math.min(1500, POLL_MS / (queue.current.length + 1))));
    };
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        // The feed answers 204 without a body when it has nothing newer
        // than the newest event known here (same second: nothing beyond
        // the `seen` ones).
        const { ts: top, n } = newest.current;
        const r = await fetch(`${basePath}${feed}${feed.includes("?") ? "&" : "?"}since=${top}&seen=${n}`, { cache: "no-store" });
        if (r.status === 204 || !r.ok) return;
        const j: { rows: T[]; flags: Flags } = await r.json();
        // Only events at least as new as the newest one shown (or queued)
        // run in, oldest first, so the newest ends up on top. Older ones
        // that only now enter the window (e.g. after hidden players were
        // filtered out) are not new and stay out.
        const add = j.rows.filter((e) => e.ts >= top && !known.current.has(key(e))).sort((a, b) => a.ts - b.ts);
        if (!add.length) return;
        for (const e of add) known.current.add(key(e));
        newest.current = newerWith(newest.current, add);
        if (known.current.size > 500) known.current = new Set(j.rows.map(key));
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
  }, [feed, running, resumed, shown, key]);
  return data;
}

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
  timeZone,
  live,
  withServer,
  initial,
  initialFlags,
  labels,
  more,
}: {
  title: ReactNode;
  // Path of the JSON feed below the base path, e.g. "/cstrike/events-feed".
  feed: string;
  pauseKey: string;
  shown: number;
  game: string;
  lang: Lang;
  // The server's time zone (siteTimeZone), so the times hydrate as sent.
  timeZone: string;
  live: boolean;
  withServer: boolean;
  initial: GameEvent[];
  initialFlags: Flags;
  labels: Labels;
  // After the heading, e.g. a link to the full list.
  more?: ReactNode;
}) {
  const { on, toggle, resumed } = useLiveSwitch(pauseKey);
  const { rows, flags, fresh } = useLiveRows({ feed, running: live && on, resumed, shown, initial, initialFlags, key: keyOf });
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
      {more ? <> {more}</> : null}
    </>
  ) : (
    <>
      {title}
      {more ? <> {more}</> : null}
    </>
  );
  const aside = live ? <LiveSwitch on={on} toggle={toggle} label={labels.liveUpdates} /> : null;
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
                  <td className="muted nowrap ev-time">{fmtDateTime(e.ts, lang, timeZone)}</td>
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

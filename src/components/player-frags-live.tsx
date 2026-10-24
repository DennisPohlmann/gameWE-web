"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PlayerLink, Section, TableWrap } from "@/components/ui";
import { basePath } from "@/lib/base-path";
import { fmtDateTime } from "@/lib/format";
import type { Frag } from "@/lib/data";
import type { Lang } from "@/translations/languages";

type Flags = Record<number, { flag: string | null; country: string | null; nolink?: boolean }>;
type Labels = { date: string; kills: string; weapons: string; map: string; killed: string; killedBy: string; liveData: string; liveUpdates: string };

const POLL_MS = 4_000;
// The visitor's choice of the live switch, per browser.
const PAUSE_KEY = "gamewe-live-frags";
const SHOWN = 25;
const keyOf = (f: Frag) => `${f.timestamp_id}-${f.killerId}-${f.victimId}-${f.weapon}-${f.headshot}`;
// Two frags can be identical (same second, players and weapon), so every
// row gets its own id (see game-events-live.tsx).
type Row = Frag & { id: number };
let seq = 0;
const withId = (f: Frag): Row => ({ ...f, id: ++seq });

// The recent kills and deaths on a player's page. Live: while the page is
// visible it asks for this player's latest frags every few seconds and puts
// new ones on top, like the latest events on a ranking's start page. A
// switch in the section head pauses the updates (no requests while paused).
export function PlayerFragsLive({
  title,
  game,
  playerId,
  lang,
  live,
  initial,
  initialFlags,
  labels,
}: {
  title: ReactNode;
  game: string;
  playerId: number;
  lang: Lang;
  live: boolean;
  initial: Frag[];
  initialFlags: Flags;
  labels: Labels;
}) {
  const [data, setData] = useState<{ rows: Row[]; flags: Flags; fresh: Set<number> }>(() => ({ rows: initial.slice(0, SHOWN).map(withId), flags: initialFlags, fresh: new Set() }));
  const known = useRef(new Set(initial.map(keyOf)));
  const newest = useRef(initial.reduce((m, f) => Math.max(m, f.timestamp_id), 0));
  const [on, setOn] = useState(true);
  const resumed = useRef(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(PAUSE_KEY) === "off") setOn(false);
    } catch {}
  }, []);
  const toggle = () => {
    resumed.current = !on;
    setOn(!on);
    try {
      if (on) localStorage.setItem(PAUSE_KEY, "off");
      else localStorage.removeItem(PAUSE_KEY);
    } catch {}
  };
  const running = live && on;
  useEffect(() => {
    if (!running) return;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`${basePath}/${encodeURIComponent(game)}/players/${playerId}/kills-feed`, { cache: "no-store" });
        if (!r.ok) return;
        const j: { rows: Frag[]; flags: Flags } = await r.json();
        // Only frags at least as new as the newest one shown, newest on top.
        const add = j.rows.filter((f) => f.timestamp_id >= newest.current && !known.current.has(keyOf(f))).sort((a, b) => b.timestamp_id - a.timestamp_id);
        if (!add.length) return;
        for (const f of add) known.current.add(keyOf(f));
        if (known.current.size > 500) known.current = new Set(j.rows.map(keyOf));
        newest.current = Math.max(newest.current, ...add.map((f) => f.timestamp_id));
        const rows = add.map(withId);
        setData((d) => ({ rows: [...rows, ...d.rows].slice(0, SHOWN), flags: { ...d.flags, ...j.flags }, fresh: new Set(rows.map((x) => x.id)) }));
      } catch {}
    };
    // Switched on again: ask right away, then every few seconds.
    if (resumed.current) {
      resumed.current = false;
      void load();
    }
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [game, playerId, running]);
  const { rows, flags, fresh } = data;
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
      <TableWrap>
        <table className={live ? "game-events live" : undefined}>
          <thead>
            <tr>
              <th>{labels.date}</th>
              <th>{labels.kills}</th>
              <th>{labels.weapons}</th>
              <th className="hide-sm">{labels.map}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => {
              const mine = f.killerId === playerId;
              return (
                <tr key={f.id} className={fresh.has(f.id) ? "ev-new" : undefined}>
                  <td className="muted nowrap">{fmtDateTime(f.timestamp_id, lang)}</td>
                  <td>
                    {mine ? (
                      <>
                        <span className="good">{labels.killed}</span>{" "}
                        <PlayerLink game={game} id={f.victimId} name={f.victimName} flag={flags[f.victimId]} />
                      </>
                    ) : (
                      <>
                        <span className="bad">{labels.killedBy}</span>{" "}
                        <PlayerLink game={game} id={f.killerId} name={f.killerName} flag={flags[f.killerId]} />
                      </>
                    )}
                  </td>
                  <td>
                    {f.weapon ?? "-"}
                    {f.headshot ? <span className="hs" title="Headshot">HS</span> : null}
                  </td>
                  <td className="hide-sm">{f.map ?? "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </Section>
  );
}

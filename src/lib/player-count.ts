// Players online as "real (bots BOT) / slots". act_players counts humans and
// bots (collector DB-SEMANTICS), the bots come from hlstats_Livestats; the
// live rows can briefly hold more bots than act_players (map change), so the
// bots are capped at the count and the real players never go below 0.
export type PlayerCount = { real: number; bots: number; max: number };

export function playerCount(act: number | string | null | undefined, bots: number | string | null | undefined, max: number | string | null | undefined): PlayerCount {
  const n = (v: number | string | null | undefined) => Math.max(0, Math.trunc(Number(v) || 0));
  const total = n(act);
  const b = Math.min(n(bots), total);
  return { real: total - b, bots: b, max: n(max) };
}

// Sum of several servers (each one capped on its own first).
export function sumCounts(counts: PlayerCount[]): PlayerCount {
  return counts.reduce((s, c) => ({ real: s.real + c.real, bots: s.bots + c.bots, max: s.max + c.max }), { real: 0, bots: 0, max: 0 });
}

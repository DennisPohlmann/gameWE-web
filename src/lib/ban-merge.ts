// One entry per banned player on the bans page and in the profile: a
// player with several running bans (a VAC ban from Steam and a SourceBans
// ban, ...) is shown once with one badge per ban. No imports, so the tests
// can load it directly.

export type BanKind = "vac" | "sourcebans" | "sourcemod" | "amx" | "engine";

// One running ban: at in Unix seconds (null when the source gives no usable
// date, dateText then holds its own text), length as shown, until the end
// (Unix seconds) when known.
export type BanEntry = { kind: BanKind; at: number | null; dateText: string; reason: string; length: string; until: number | null };

// The order of the badges: VAC (yellow) first, then the others (red).
const ORDER: BanKind[] = ["vac", "sourcebans", "sourcemod", "amx", "engine"];

export function banKind(v: string | null | undefined): BanKind {
  return ORDER.find((k) => k === v) ?? "engine";
}

// The colour of the "!" behind the name: yellow for VAC alone, red for the
// other bans (SourceBans, server bans), "both" (split red/yellow) when a
// VAC ban and another one run.
export function markKind(bans: BanEntry[]): "vac" | "red" | "both" {
  const vac = bans.some((b) => b.kind === "vac");
  const red = bans.some((b) => b.kind !== "vac");
  return vac && red ? "both" : vac ? "vac" : "red";
}

// The badges of a banned player: VAC and SourceBans always side by side
// (those in `always`, i.e. the sources the site checks; ban null = does not
// apply, shown grey), server bans only when one runs; in badge order.
export function banSlots(bans: BanEntry[], always: BanKind[]): { kind: BanKind; ban: BanEntry | null }[] {
  return ORDER.flatMap((kind) => {
    const ban = bans.find((b) => b.kind === kind) ?? null;
    return ban || always.includes(kind) ? [{ kind, ban }] : [];
  });
}

// The bans of each player (by key) in badge order, one ban per kind (the
// newest), with the newest date as the row's date. Players keep the order
// of their first ban in rows.
export function mergeBans<P>(rows: { player: P; ban: BanEntry }[], key: (p: P) => number): { player: P; bans: BanEntry[]; at: number | null; dateText: string }[] {
  const by = new Map<number, { player: P; bans: BanEntry[] }>();
  for (const r of rows) {
    const k = key(r.player);
    const e = by.get(k) ?? { player: r.player, bans: [] };
    const same = e.bans.findIndex((b) => b.kind === r.ban.kind);
    if (same < 0) e.bans.push(r.ban);
    else if ((r.ban.at ?? 0) > (e.bans[same].at ?? 0)) e.bans[same] = r.ban;
    by.set(k, e);
  }
  return [...by.values()].map((e) => {
    const bans = [...e.bans].sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
    const newest = bans.reduce<BanEntry | null>((n, b) => (!n || (b.at ?? 0) > (n.at ?? 0) ? b : n), null);
    return { player: e.player, bans, at: newest?.at ?? null, dateText: newest?.at ? "" : (bans.find((b) => b.dateText)?.dateText ?? "") };
  });
}

// The reason shown in the row: that of the newest ban other than VAC, else
// the VAC one.
export function mainReason(bans: BanEntry[]): string {
  const red = bans.filter((b) => b.kind !== "vac").sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  return (red[0] ?? bans[0])?.reason ?? "";
}

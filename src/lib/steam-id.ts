// Steam IDs in their three forms. Run the tests with `npm test`.

// "STEAM_0:1:123" or "1:123" -> Steam IDs. Bots and unknown formats return null.
// CS:GO logs "[U:1:123]" or a SteamID64 instead, so those work too.
export function steamIds(uniqueId: string | null | undefined) {
  const s = (uniqueId ?? "").trim().replace(/^steam_/i, "STEAM_").replace(/^\[?u:/i, (x) => x.toUpperCase());
  const base = 76561197960265728n;
  let account: bigint;
  const m = /^(?:STEAM_\d:)?([01]):(\d{1,10})$/.exec(s);
  const u = /^\[?U:1:(\d{1,10})\]?$/.exec(s);
  if (m) account = BigInt(m[2]) * 2n + BigInt(m[1]);
  else if (u) account = BigInt(u[1]);
  else if (/^7656119\d{10}$/.test(s) && BigInt(s) > base) account = BigInt(s) - base;
  else return null;
  if (account <= 0n || account >= 2n ** 32n) return null;
  return {
    steam2: `STEAM_0:${account % 2n}:${account / 2n}`,
    steam3: `[U:1:${account}]`,
    steam64: String(76561197960265728n + account),
  };
}

// The forms a Steam ID can have in hlstats_PlayerUniqueIds, for a search by
// any of them (STEAM_0:1:23, STEAM_1:1:23, [U:1:47], 7656119…, also lower
// case): the collector stores "1:23" (HLstatsX:CE), others the full forms.
// null: q is no Steam ID.
export function steamSearchIds(q: string): string[] | null {
  const ids = steamIds(q);
  if (!ids) return null;
  const acc = BigInt(ids.steam64) - 76561197960265728n;
  const y = acc % 2n;
  const z = acc / 2n;
  return [`${y}:${z}`, `STEAM_0:${y}:${z}`, `STEAM_1:${y}:${z}`, `[U:1:${acc}]`, `U:1:${acc}`, ids.steam64];
}

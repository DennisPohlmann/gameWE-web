// Counts per time bucket (e.g. frags per 15 minutes) read incrementally: the
// first load reads every bucket from `start`, later loads only the newest
// `overlap` buckets again (events of the last minutes may still arrive), the
// older buckets stay in memory. A full read every `fullEvery` ms picks up
// deletions (a reset) and late imports. Production slow log 2026-11-11: the
// full month of frags was 2.4 million rows, 2.4 s, on every reload.
// No imports, so the tests can load it directly.
export type BucketRow = { h: number; a: number; b: number };

type Entry = { since: number; full: number; upto: number; rows: Map<number, [number, number]> };

export function bucketCache(step: number, fullEvery: number, overlap = 2) {
  const keys = new Map<string, Entry>();
  // start, now: Unix seconds; load(from) returns the buckets h (= floor(ts / step)) from `from` on.
  return async (key: string, start: number, now: number, load: (from: number) => Promise<BucketRow[]>): Promise<Map<number, [number, number]>> => {
    const hit = keys.get(key);
    const fresh = !hit || hit.since > start || now * 1000 - hit.full >= fullEvery;
    const from = fresh ? start : Math.max(start, hit.upto - (overlap - 1) * step);
    const got = await load(from);
    const rows = fresh ? new Map<number, [number, number]>() : new Map(hit.rows);
    // The re-read buckets are replaced whole: a bucket without frags now has none.
    for (const h of rows.keys()) if (h * step >= from) rows.delete(h);
    for (const r of got) rows.set(Number(r.h), [Number(r.a), Number(r.b ?? 0)]);
    const first = Math.floor(start / step);
    for (const h of rows.keys()) if (h < first) rows.delete(h);
    keys.set(key, { since: fresh ? start : hit.since, full: fresh ? now * 1000 : hit.full, upto: Math.floor(now / step) * step, rows });
    return rows;
  };
}

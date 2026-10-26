// A small in-memory cache for slow aggregate queries over all players of a
// ranking (hundreds of thousands of rows after an HLstatsX import). On MyISAM
// a long read also holds back the collector's writes to the table and every
// read queued behind them, so such queries should run rarely, not once per
// page view. No imports, so the tests can load it directly.
//
// A value is fresh for `ttl` ms. After that, for up to `stale` ms more, the
// old value is still returned at once while one reload runs in the
// background (the next visitor gets the new one); older values are loaded
// again while the visitor waits. A failed load is not kept.

type Entry<T> = { at: number; value: Promise<T>; ready: boolean; reloading: boolean };

export function ttlCache<T>(ttl: number, stale = 0, max = 200) {
  const map = new Map<string, Entry<T>>();
  const load = (key: string, fn: () => Promise<T>, old?: Entry<T>): Promise<T> => {
    if (map.size >= max && !map.has(key)) map.clear();
    const value = fn();
    const e: Entry<T> = { at: Date.now(), value, ready: false, reloading: false };
    value.then(
      () => {
        e.ready = true;
        map.set(key, e);
      },
      () => {
        // Keep the old value after a failed reload; drop a failed first load.
        if (old) old.reloading = false;
        else if (map.get(key) === e) map.delete(key);
      },
    );
    if (!old) map.set(key, e);
    return value;
  };
  return (key: string, fn: () => Promise<T>): Promise<T> => {
    const hit = map.get(key);
    const age = hit ? Date.now() - hit.at : Infinity;
    if (hit && age < ttl) return hit.value;
    if (hit && hit.ready && age < ttl + stale) {
      if (!hit.reloading) {
        hit.reloading = true;
        load(key, fn, hit).catch(() => {});
      }
      return hit.value;
    }
    return load(key, fn);
  };
}

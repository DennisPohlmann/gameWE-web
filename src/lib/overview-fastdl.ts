// Radar pictures of maps that have none, drawn from the map on the game
// server's FastDL (Settings → Maps & events, off by default; a ranking may have
// its own address): a page asks,
// a separate process (scripts/overviews/fastdl.ts) does the work, one at a
// time, and the next visit of the page has the picture. Map names come from
// the game servers, so only strict names get here, each is tried once a day
// and the queue is short.
import { spawn } from "node:child_process";
import path from "node:path";
import { OWN_OVERVIEWS } from "./content-dirs";
import { MAP_NAME } from "./overview-format";

const GAME = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const RETRY_MS = 24 * 3600_000;
const MAX_QUEUE = 16;
const MAX_REMEMBERED = 2000;
const RUN_LIMIT_MS = 15 * 60_000;
const HEAP_MB = 2048;

// headers: what the download sends besides the address (lib/fastdl-access.ts).
export type Runner = (base: string, map: string, dir: string, done: (ok: boolean) => void, headers?: Record<string, string>) => void;

const runProcess: Runner = (base, map, dir, done, headers = {}) => {
  const script = path.join(process.cwd(), "scripts/overviews/build/fastdl.js");
  // No environment but its own: the process has no business with the site's
  // secrets. The headers go in the environment, not the command line, which
  // every user of the host can see.
  const env: Record<string, string> = process.env.FASTDL_ALLOW_PRIVATE === "1" ? { FASTDL_ALLOW_PRIVATE: "1" } : {};
  if (Object.keys(headers).length) env.FASTDL_HEADERS = JSON.stringify(headers);
  const child = spawn(process.execPath, [`--max-old-space-size=${HEAP_MB}`, script, base, map, dir], { env: env as NodeJS.ProcessEnv, stdio: ["ignore", "ignore", "pipe"], timeout: RUN_LIMIT_MS, killSignal: "SIGKILL" });
  let err = "";
  child.stderr.on("data", (d) => {
    if (err.length < 400) err += String(d);
  });
  child.on("error", (e) => {
    console.warn(`overview ${map}: FastDL process failed: ${e.message}`);
  });
  child.on("close", (code) => {
    if (code !== 0) console.warn(`overview ${map}: nothing from FastDL (${err.replace(/[\x00-\x1f\x7f]+/g, " ").trim().slice(0, 300) || "time limit"})`);
    done(code === 0);
  });
};

export function fastdlQueue(run: Runner, dirOf: (game: string) => string, now: () => number = Date.now) {
  const tried = new Map<string, number>();
  const waiting: { base: string; map: string; dir: string; done?: () => void; headers?: Record<string, string> }[] = [];
  let busy = false;
  const next = () => {
    const job = waiting.shift();
    if (!job) {
      busy = false;
      return;
    }
    busy = true;
    run(
      job.base,
      job.map,
      job.dir,
      (ok) => {
        if (ok) job.done?.();
        next();
      },
      job.headers,
    );
  };
  return (base: string, game: string, map: string, done?: () => void, headers?: Record<string, string>): boolean => {
    if (!base || !GAME.test(game) || !MAP_NAME.test(map) || waiting.length >= MAX_QUEUE) return false;
    // With the address: a map that failed on the old one can try a new one at once.
    const key = `${base} ${game}/${map}`;
    const at = tried.get(key);
    if (at !== undefined && now() - at < RETRY_MS) return false;
    if (tried.size >= MAX_REMEMBERED) tried.clear();
    tried.set(key, now());
    waiting.push({ base, map, dir: dirOf(game), done, headers });
    if (!busy) next();
    return true;
  };
}

export const requestOverview = fastdlQueue(runProcess, (game) => path.join(OWN_OVERVIEWS, game));

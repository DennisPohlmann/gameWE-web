// Renders every map of <bsp-root>/<game>/ into <out-root>/<game>/ (PNG and
// calibration JSON), with the .nav where there is one. Skips maps already done.
//
//   npm run radar:all -- <bsp-root> <out-root> [workers]
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { availableParallelism } from "node:os";
import path from "node:path";

const [src, out, w] = process.argv.slice(2);
if (!src || !out) {
  console.error("usage: npm run radar:all -- <bsp-root> <out-root> [workers]");
  process.exit(1);
}
const workers = w ? Number(w) : Math.max(1, Math.floor(availableParallelism() / 2));
const radar = path.join(path.dirname(process.argv[1]), "radar.js");
const jobs: { game: string; map: string; args: string[] }[] = [];
for (const game of readdirSync(src).sort()) {
  const gdir = path.join(src, game);
  if (!statSync(gdir).isDirectory() || game === "css") continue;
  mkdirSync(path.join(out, game), { recursive: true });
  for (const f of readdirSync(gdir).sort()) {
    if (!f.endsWith(".bsp")) continue;
    const map = f.slice(0, -4);
    const png = path.join(out, game, `${map}.png`);
    if (existsSync(png)) continue;
    const nav = path.join(gdir, `${map}.nav`);
    jobs.push({ game, map, args: [path.join(gdir, f), existsSync(nav) ? nav : "-", png, `${png.slice(0, -4)}.json`] });
  }
}

function run(job: (typeof jobs)[number]): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(process.execPath, [radar, ...job.args], { timeout: 900_000, maxBuffer: 1 << 26 }, (err, stdout, stderr) => {
      const ok = !err;
      const last = (text: string) => text.trim().split("\n").pop() ?? "";
      const msg = err?.killed ? "timeout" : last(ok ? stdout : stderr);
      console.log(`${ok ? "ok  " : "FAIL"} ${job.game}/${job.map} ${msg}`);
      resolve(ok);
    });
  });
}

console.log(`${jobs.length} maps, ${workers} workers`);
let nextJob = 0;
let done = 0;
void Promise.all(
  Array.from({ length: workers }, async () => {
    while (nextJob < jobs.length) if (await run(jobs[nextJob++])) done++;
  }),
).then(() => console.log(`done: ${done} ok, ${jobs.length - done} failed`));

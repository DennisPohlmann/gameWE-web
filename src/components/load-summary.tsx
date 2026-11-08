import type { LoadPoint } from "@/lib/data";
import { fmtDuration, fmtNum } from "@/lib/format";
import { steadyFps } from "@/lib/fps";
import type { Dict, Lang } from "@/lib/i18n";

// The line above a server's load graph (server page and the ranking's start
// page): average players over the whole graph and the last hour, the
// server's average FPS of the last hour when the collector got any, and the
// uptime of the latest sample.
export function LoadSummary({ points, now, t, lang }: { points: LoadPoint[]; now: number; t: Dict; lang: Lang }) {
  const avg = (vals: number[]) => (vals.length ? vals.reduce((n, v) => n + v, 0) / vals.length : null);
  const hour = points.filter((l) => l.timestamp >= now - 3600);
  const steady = steadyFps(points.map((l) => l.fps));
  const fps = avg(points.flatMap((l, i) => (l.timestamp >= now - 3600 && steady[i] > 0 ? [steady[i]] : [])));
  return (
    <>
      {t.avgPlayers24h}: <b>{fmtNum(avg(points.map((l) => l.act_players)), lang, 1)}</b> · {t.lastHour}: <b>{fmtNum(avg(hour.map((l) => l.act_players)), lang, 1)}</b>
      {fps !== null ? (
        <>
          {" "}
          · Ø FPS: <b>{fmtNum(fps, lang)}</b>
        </>
      ) : null}{" "}
      · {t.uptime}: <b>{fmtDuration(points[points.length - 1].uptime * 60)}</b>
    </>
  );
}

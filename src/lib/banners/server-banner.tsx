import "server-only";
import { cachedBanner } from "./cache";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getGame, getServer, getServerLoad } from "@/lib/data";
import { statsOrigin } from "@/lib/site-url";
import { FLAG_CODES } from "@/lib/flag-codes";
import { fmtNum, nowUnix } from "@/lib/format";
import { imageTheme, parseImageFile } from "@/lib/image-theme";
import { dicts } from "@/translations";
import { imageLang, optionsKey, type BannerOptions } from "./options";
import { wideBanner } from "./wide-banner";

// Server banner, 560x95: file "<serverId>.png" in the banner of the active
// skin, "<serverId>-<template>.png" in that of a design template; o the
// layout, background and language (lib/banners/options.ts). Name with flag,
// address, port, status, players with a pie, map and the players of the last
// 24 hours. With code set (banner/<code>/server/...) the server must belong
// to that ranking; null only for the old /banner/<file>.
export function serverBanner(file: string, code: string | null, o: BannerOptions) {
  return cachedBanner(`server|${code ?? ""}|${optionsKey(o)}`, file, () => render(file, code, o));
}

async function render(file: string, code: string | null, o: BannerOptions) {
  const f = parseImageFile(file);
  const s = f ? await getServer(f.id) : undefined;
  if (!s || (code !== null && s.game !== code)) return new Response("not found", { status: 404 });
  const now = nowUnix();
  const [game, load, origin] = await Promise.all([getGame(s.game), getServerLoad(s.serverId, now - 86400), statsOrigin()]);
  if (!game) return new Response("not found", { status: 404 });
  const th = await imageTheme(f?.style ?? null, game);
  const lang = imageLang(o.lang);
  const t = dicts[lang];
  const cc = (s.country_code ?? "").trim().toLowerCase();
  const flag = FLAG_CODES.has(cc) ? await flagDataUrl(cc) : null;
  const addr = s.publicaddress || `${s.address}:${s.port}`;
  const cut = addr.lastIndexOf(":");
  const ip = cut > 0 ? addr.slice(0, cut) : addr;
  const port = cut > 0 ? addr.slice(cut + 1) : String(s.port);
  // Online while the collector keeps writing load samples (every 10 minutes).
  const online = load.length > 0 && load[load.length - 1].timestamp >= now - 1800;
  const act = Number(s.act_players) || 0;
  const max = Number(s.max_players) || 0;
  const share = max ? Math.min(1, act / max) : 0;
  const status = online ? t.online : t.offline;

  // The graph's scale: at most four steps of 1, 2, 5, 10, 20, 25, 50 or 100 players.
  const peak = Math.max(1, max, ...load.map((l) => l.act_players));
  const step = [1, 2, 5, 10, 20, 25, 50, 100].find((n) => peak / n <= 4) ?? Math.ceil(peak / 400) * 100;
  const top = Math.ceil(peak / step) * step;

  return wideBanner(
    {
      th,
      kind: t.server,
      name: s.name || addr,
      flag,
      hero: { label: t.players, value: fmtNum(act, lang), max: fmtNum(max, lang), share, note: t.slotsShare.replace("{n}", `${Math.round(share * 100)} %`) },
      online,
      status,
      cells: [
        { label: t.ipAddress, value: ip },
        { label: t.players, value: `${act}/${max}`, pie: share },
        { label: t.port, value: port },
        { label: t.onlineState, value: status, color: online ? th.good : th.bad, status: true },
        { label: t.map, value: s.act_map || "-" },
      ],
      graph: {
        label: t.players24h,
        points: load.map((l) => [(l.timestamp - (now - 86400)) / 86400, l.act_players / top]),
        ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step),
        top,
      },
      host: origin.replace(/^https?:\/\//, ""),
      link: `${origin}/${s.game}/servers/${s.serverId}`,
      small: [{ label: "", value: addr }, { label: t.map, value: s.act_map || "-" }],
    },
    o,
    300,
  );
}

// Flag from public/flags as a data URL (cc is checked against FLAG_CODES).
export async function flagDataUrl(cc: string): Promise<string | null> {
  try {
    const svg = await readFile(path.join(process.cwd(), "public", "flags", `${cc}.svg`));
    return `data:image/svg+xml;base64,${svg.toString("base64")}`;
  } catch {
    return null;
  }
}

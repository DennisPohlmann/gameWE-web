import "server-only";
import { cachedBanner } from "./cache";
import { FLAG_CODES } from "@/lib/flag-codes";
import { fmtDuration, fmtNum } from "@/lib/format";
import { imageTheme, parseVoiceBannerFile } from "@/lib/image-theme";
import { statsOrigin } from "@/lib/site-url";
import { getVoiceBox } from "@/lib/voice";
import { dicts } from "@/translations";
import { flagDataUrl } from "./server-banner";
import { voiceBannerData } from "./voice-banner-data";
import { imageLang, optionsKey, type BannerOptions } from "./options";
import { wideBanner } from "./wide-banner";

// TeamSpeak banner, 560x95: file "teamspeak.png" in the banner of the active
// skin, "teamspeak-<template>.png" in that of a design template; o the
// layout, background and language (lib/banners/options.ts). Only live data
// from the ServerQuery (kept for a minute in src/lib/voice.ts): name with
// flag, address (never shortened), status, users online of the slots,
// channels and uptime. When the query fails the banner says Offline; 404 unless
// TeamSpeak is the voice server.
export function voiceBanner(file: string, o: BannerOptions) {
  return cachedBanner(`voice|${optionsKey(o)}`, file, () => render(file, o));
}

async function render(file: string, o: BannerOptions) {
  const f = parseVoiceBannerFile(file);
  const box = f ? await getVoiceBox() : null;
  if (!f || !box?.ts) return new Response("not found", { status: 404 });
  const d = voiceBannerData(box.ts);
  const [th, origin] = await Promise.all([imageTheme(f.style, null), statsOrigin()]);
  const lang = imageLang(o.lang);
  const t = dicts[lang];
  const flag = d.country && FLAG_CODES.has(d.country) ? await flagDataUrl(d.country) : null;
  const status = d.online ? t.online : t.offline;
  return wideBanner(
    {
      th,
      kind: "TeamSpeak",
      name: d.name || d.address,
      flag,
      hero: {
        label: t.voiceUsersOnline,
        value: d.clients === null ? "-" : fmtNum(d.clients, lang),
        max: d.max === null ? "-" : fmtNum(d.max, lang),
        share: d.share,
        note: d.online ? t.slotsShare.replace("{n}", `${Math.round(d.share * 100)} %`) : "-",
      },
      online: d.online,
      status,
      cells: [
        { label: t.address, value: d.address, full: true },
        { label: t.onlineState, value: status, color: d.online ? th.good : th.bad, status: true },
        { label: t.channels, value: d.channels === null ? "-" : fmtNum(d.channels, lang) },
        { label: t.uptime, value: d.uptime === null ? "-" : fmtDuration(d.uptime) },
      ],
      graph: null,
      host: origin.replace(/^https?:\/\//, ""),
    },
    o,
    60,
  );
}

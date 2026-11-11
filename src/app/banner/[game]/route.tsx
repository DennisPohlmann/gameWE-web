import { serverBanner } from "@/lib/banners/server-banner";
import { voiceBanner } from "@/lib/banners/voice-banner";
import { bannerBusy } from "@/lib/banners/cache";
import { bannerOptions } from "@/lib/banners/options";

// /banner/teamspeak.png (and -<template>.png, in a language
// /banner/<lang>/teamspeak.png): the TeamSpeak banner. Any other file is the
// old server banner URL /banner/<serverId>.png (and -<template>.png), kept as
// an alias of /banner/<game>/server/... so banners already posted in forums
// keep working. The segment is named [game] because Next.js allows one slug
// name per level; here it holds the file name.
export async function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  const busy = await bannerBusy();
  if (busy) return busy;
  const file = (await params).game;
  const url = new URL(req.url);
  return file.startsWith("teamspeak") ? voiceBanner(file, bannerOptions("voice", url)) : serverBanner(file, null, bannerOptions("server", url));
}

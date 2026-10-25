import { serverBanner } from "@/lib/banners/server-banner";
import { voiceBanner } from "@/lib/banners/voice-banner";

// /banner/teamspeak.png (and -<template>.png): the TeamSpeak banner. Any
// other file is the old server banner URL /banner/<serverId>.png (and
// -<template>.png), kept as an alias of /banner/<game>/server/... so banners
// already posted in forums keep working. The segment is named [game] because
// Next.js allows one slug name per level; here it holds the file name.
export async function GET(_req: Request, { params }: { params: Promise<{ game: string }> }) {
  const file = (await params).game;
  return file.startsWith("teamspeak") ? voiceBanner(file) : serverBanner(file, null);
}

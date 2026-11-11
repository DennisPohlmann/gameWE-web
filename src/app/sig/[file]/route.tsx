import { playerBanner } from "@/lib/banners/player-banner";
import { bannerBusy } from "@/lib/banners/cache";
import { bannerOptions } from "@/lib/banners/options";

// Old forum signature URL /sig/<playerId>.png (and -<template>.png), kept as
// an alias of /banner/<game>/player/... so signatures already posted in
// forums keep working; /sig/<lang>/<playerId>.png as well.
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  return (await bannerBusy()) ?? playerBanner((await params).file, null, bannerOptions("player", new URL(req.url)));
}

import { playerBanner } from "@/lib/banners/player-banner";
import { bannerBusy } from "@/lib/banners/cache";
import { bannerOptions } from "@/lib/banners/options";

// Player banner (forum signature): /banner/<game>/player/<playerId>.png (and -<template>.png),
// in a language /banner/<game>/player/<lang>/<playerId>.png (next.config.ts),
// ?layout= and ?bg= (lib/banners/options.ts).
export async function GET(req: Request, { params }: { params: Promise<{ game: string; file: string }> }) {
  const { game, file } = await params;
  return (await bannerBusy()) ?? playerBanner(file, game, bannerOptions("player", new URL(req.url)));
}

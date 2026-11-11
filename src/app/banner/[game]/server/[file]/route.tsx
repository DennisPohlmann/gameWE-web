import { serverBanner } from "@/lib/banners/server-banner";
import { bannerBusy } from "@/lib/banners/cache";
import { bannerOptions } from "@/lib/banners/options";

// Server banner: /banner/<game>/server/<serverId>.png (and -<template>.png),
// in a language /banner/<game>/server/<lang>/<serverId>.png, ?layout= and ?bg=.
export async function GET(req: Request, { params }: { params: Promise<{ game: string; file: string }> }) {
  const { game, file } = await params;
  return (await bannerBusy()) ?? serverBanner(file, game, bannerOptions("server", new URL(req.url)));
}

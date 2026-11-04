import { serverBanner } from "@/lib/banners/server-banner";
import { bannerBusy } from "@/lib/banners/cache";

// Server banner: /banner/<game>/server/<serverId>.png (and -<template>.png).
export async function GET(_req: Request, { params }: { params: Promise<{ game: string; file: string }> }) {
  const { game, file } = await params;
  return (await bannerBusy()) ?? serverBanner(file, game);
}

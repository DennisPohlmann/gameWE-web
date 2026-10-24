import { playerBanner } from "@/lib/banners/player-banner";

// Player banner (forum signature): /banner/<game>/player/<playerId>.png (and -<template>.png).
export async function GET(_req: Request, { params }: { params: Promise<{ game: string; file: string }> }) {
  const { game, file } = await params;
  return playerBanner(file, game);
}

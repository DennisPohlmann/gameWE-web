import { serverBanner } from "@/lib/banners/server-banner";

// Server banner: /banner/<game>/server/<serverId>.png (and -<template>.png).
export async function GET(_req: Request, { params }: { params: Promise<{ game: string; file: string }> }) {
  const { game, file } = await params;
  return serverBanner(file, game);
}

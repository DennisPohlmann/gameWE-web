import { playerBanner } from "@/lib/banners/player-banner";

// Old forum signature URL /sig/<playerId>.png (and -<template>.png), kept as
// an alias of /banner/<game>/player/... so signatures already posted in
// forums keep working.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  return playerBanner((await params).file, null);
}

import { serverBanner } from "@/lib/banners/server-banner";

// Old server banner URL /banner/<serverId>.png (and -<template>.png), kept
// as an alias of /banner/<game>/server/... so banners already posted in
// forums keep working. The segment is named [game] because Next.js allows
// one slug name per level; here it holds the file name.
export async function GET(_req: Request, { params }: { params: Promise<{ game: string }> }) {
  return serverBanner((await params).game, null);
}

import "server-only";
import { notFound } from "next/navigation";
import { currentAdmin } from "./auth";
import { getGame } from "./data";

// A hidden ranking is shown to admins only. The layout of /<game> checks this
// too, but Next.js does not run a layout again for a client navigation, and a
// client can claim to have it: so every page checks, and a record found by id
// is checked for its own ranking.
export async function rankingShown(code: string): Promise<boolean> {
  return !!((await getGame(code)) ?? ((await currentAdmin()) ? await getGame(code, true) : undefined));
}

export async function rankingGate(code: string): Promise<void> {
  if (!(await rankingShown(code))) notFound();
}

import "server-only";
import { overLimit } from "@/lib/api";
import { chosenTemplate, parseImageFile, parseVoiceBannerFile } from "@/lib/banner-theme";
import { statsOrigin } from "@/lib/site-url";
import { listTemplates } from "@/lib/templates";
import { ttlCache } from "@/lib/ttl-cache";

// Banners are rendered in the one server process, about 150 ms each: one
// render per banner for five minutes, shared by all requests, and a limit per
// client on the website's routes (the API's have their own in api.ts).
const LIMIT = 120;
const cache = ttlCache<{ status: number; headers: [string, string][]; body: ArrayBuffer }>(300_000, 0, 500);

// A style that is no template shows the skin, so any such file name is the
// same picture and must not cost another render.
async function normalFile(file: string): Promise<string> {
  const f = parseImageFile(file) ?? parseVoiceBannerFile(file);
  if (!f || !f.style) return file;
  const known = chosenTemplate(f.style, (await listTemplates()).map((t) => t.id));
  return known ? file : file.replace(`-${f.style}`, "");
}

export async function cachedBanner(kind: string, file: string, render: () => Promise<Response>): Promise<Response> {
  // The address is part of the picture (statsOrigin).
  const key = `${kind}|${await normalFile(file)}|${await statsOrigin()}`;
  const b = await cache(key, async () => {
    const r = await render();
    return { status: r.status, headers: [...r.headers.entries()], body: await r.arrayBuffer() };
  });
  return new Response(b.body, { status: b.status, headers: b.headers });
}

// For the website's banner routes: the answer when over the limit, else null.
export async function bannerBusy(): Promise<Response | null> {
  const wait = await overLimit("banner", LIMIT);
  return wait ? new Response("rate limit", { status: 429, headers: { "retry-after": String(wait), "cache-control": "no-store" } }) : null;
}

import { basePath } from "@/lib/base-path";
import { mapHref } from "@/components/map-link";
import { gameOf, getActionByCode, getMap } from "@/lib/data";
import { LEGACY_SCRIPTS, legacyTarget, type LegacyScript } from "@/lib/legacy-urls";

// Old HLstatsX:CE addresses and map numbers (src/proxy.ts rewrites them here): a permanent
// redirect to the page on this site, so links in forums, bookmarks and
// search engines move over.
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ script: string }> }) {
  const { script } = await params;
  const url = new URL(req.url);
  const q = url.searchParams;
  // A map page by its old number (/css/maps/17): now by its name. req.url
  // is the address before the rewrite.
  if (script === "map") {
    const m = await getMap(Number(/\/maps\/(\d{1,10})$/.exec(url.pathname)?.[1] ?? q.get("id")));
    return m ? moved(mapHref(m.game, m.map)) : notFound();
  }
  const known = (LEGACY_SCRIPTS as readonly string[]).includes(script);
  const target = known ? await legacyTarget(script as LegacyScript, q, { gameOf, actionId: getActionByCode }) : null;
  return target ? moved(target) : notFound();
}

// Relative Location: behind a proxy req.url carries the internal address.
const moved = (path: string) => new Response(null, { status: 301, headers: { Location: `${basePath}${path}` } });
const notFound = () => new Response("Not found\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });

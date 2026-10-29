import { api, apiCountry, apiPath, eventDetail, publicPlayer } from "@/lib/api";
import { bad, enumArg, optionalEnumArg, pagingArg, paged, pathId } from "@/lib/api-params";
import { getPlayerFlags } from "@/lib/data";
import { EVENT_KINDS, countPlayerEvents, getPlayerEvents } from "@/lib/history";

// Each event table is read up to offset + limit rows: deeper pages are cut.
const MAX_DEPTH = 10_000;

// The events page of a player: connects, team and name changes, actions,
// kills, deaths, ... newest first, optionally one type. Events with a
// hidden player on the other side are left out; never chat or addresses.
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const q = new URL(req.url).searchParams;
    const type = optionalEnumArg(q, "type", EVENT_KINDS);
    const order = enumArg(q, "order", ["desc", "asc"] as const, "desc");
    const pg = pagingArg(q);
    if (pg.offset >= MAX_DEPTH) throw bad(`invalid page: the list ends after ${MAX_DEPTH} events, use type or order=asc`);
    const kinds = type ? [type] : [...EVENT_KINDS];
    const [rows, total] = await Promise.all([getPlayerEvents(p.playerId, kinds, pg.limit, pg.offset, order === "asc"), countPlayerEvents(p.playerId, kinds)]);
    const flags = await getPlayerFlags(rows.map((r) => Number(r.other)));
    return paged(
      rows.map((e) => {
        const f = flags.get(Number(e.other));
        return {
          time: e.ts,
          type: e.kind,
          other: e.other > 0 ? { id: e.other, name: e.otherName, country: f && f.flag !== "bot" ? apiCountry(f.flag, f.country) : null, bot: f?.flag === "bot" } : null,
          ...eventDetail(e.kind, e.num, e.text, e.code),
          map: e.map || null,
        };
      }),
      Math.min(total, MAX_DEPTH),
      pg,
      apiPath(`/players/${p.playerId}/events`),
      { type, order: order === "desc" ? undefined : order },
    );
  });
}

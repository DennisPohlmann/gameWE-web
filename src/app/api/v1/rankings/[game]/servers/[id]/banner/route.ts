import { apiImage, styleArg, visibleGame } from "@/lib/api";
import { pathId } from "@/lib/api-params";
import { serverBanner } from "@/lib/banners/server-banner";

// The server banner (560x95 PNG) of /banner/{game}/server/{id}.png;
// ?style= a design template.
export function GET(req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return apiImage(async () => {
    const { game: code, id } = await params;
    const style = styleArg(new URL(req.url).searchParams);
    const [game, serverId] = [await visibleGame(code), pathId(id)];
    if (!game || !serverId) return null;
    return serverBanner(style ? `${serverId}-${style}` : String(serverId), game.code);
  });
}

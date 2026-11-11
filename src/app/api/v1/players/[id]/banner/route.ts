import { apiImage, bannerArgs, publicPlayer, styleArg } from "@/lib/api";
import { pathId } from "@/lib/api-params";
import { playerBanner } from "@/lib/banners/player-banner";

// The player banner (forum signature, 400x100 PNG) of
// /banner/{game}/player/{id}.png; ?style= a design template, ?layout=, ?bg= and ?lang= as on the website.
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiImage(async () => {
    const url = new URL(req.url);
    const style = styleArg(url.searchParams);
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    return playerBanner(style ? `${p.playerId}-${style}` : String(p.playerId), p.game, bannerArgs("player", url));
  });
}

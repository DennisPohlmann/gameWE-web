import { apiImage, bannerArgs, styleArg } from "@/lib/api";
import { voiceBanner } from "@/lib/banners/voice-banner";

// The TeamSpeak banner (560x95 PNG) of /banner/teamspeak.png; ?style= a design
// template, ?layout=, ?bg= and ?lang= as on the website.
export function GET(req: Request) {
  return apiImage(async () => {
    const url = new URL(req.url);
    const style = styleArg(url.searchParams);
    return voiceBanner(style ? `teamspeak-${style}.png` : "teamspeak.png", bannerArgs("voice", url));
  });
}

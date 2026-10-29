import { apiImage, styleArg } from "@/lib/api";
import { voiceBanner } from "@/lib/banners/voice-banner";

// The TeamSpeak banner (560x95 PNG) of /banner/teamspeak.png; ?style= a
// design template.
export function GET(req: Request) {
  return apiImage(async () => {
    const style = styleArg(new URL(req.url).searchParams);
    return voiceBanner(style ? `teamspeak-${style}.png` : "teamspeak.png");
  });
}

import { api, apiPath } from "@/lib/api";
import { getVoiceBox } from "@/lib/voice";

// The voice server box of the start page: the TeamSpeak server (live from
// its ServerQuery, kept for a minute) or the Discord server (its widget).
export function GET() {
  return api(async () => {
    const { ts, discord } = await getVoiceBox();
    return {
      teamspeak: ts
        ? {
            name: ts.name,
            type: ts.type,
            country: ts.country ? ts.country.toUpperCase() : null,
            address: ts.address,
            link: ts.link,
            // Like the TeamSpeak banner: whether a password is needed, never the password itself.
            passwordProtected: !!ts.password,
            clients: ts.clients,
            maxClients: ts.max,
            channels: ts.channels,
            uptime: ts.uptime,
            detailsUrl: apiPath("/voice/teamspeak"),
            bannerUrl: apiPath("/voice/teamspeak/banner"),
          }
        : null,
      discord: discord ? { name: discord.name, invite: discord.invite || null, online: discord.online } : null,
    };
  });
}

import { api, apiPath } from "@/lib/api";
import { getVoiceBox } from "@/lib/voice";

// The voice server box of the start page: the TeamSpeak server (live from
// its ServerQuery, kept for a minute), the Ventrilo server (its UDP status,
// kept for a minute) or the Discord server (its widget).
export function GET() {
  return api(async () => {
    const { ts, discord, vent } = await getVoiceBox();
    return {
      teamspeak: ts
        ? {
            name: ts.name,
            type: ts.type,
            country: ts.country ? ts.country.toUpperCase() : null,
            address: ts.address,
            link: ts.link,
            // The password only while the admin allows showing it (tsPassword).
            passwordProtected: ts.passwordProtected,
            password: ts.password || null,
            clients: ts.clients,
            maxClients: ts.max,
            channels: ts.channels,
            uptime: ts.uptime,
            detailsUrl: apiPath("/voice/teamspeak"),
            bannerUrl: apiPath("/voice/teamspeak/banner"),
          }
        : null,
      ventrilo: vent
        ? {
            name: vent.name,
            type: vent.type,
            address: vent.address,
            link: vent.link,
            passwordProtected: vent.passwordProtected,
            clients: vent.clients,
            maxClients: vent.max,
            channels: vent.channels,
            uptime: vent.uptime,
          }
        : null,
      discord: discord ? { name: discord.name, invite: discord.invite || null, online: discord.online } : null,
    };
  });
}

import { api, apiPath } from "@/lib/api";
import { getVoiceDetail, type VoiceChannel } from "@/lib/voice";

// The TeamSpeak page (/voice): server data, channel tree and the people
// online (their names only where the admin shows them), live from the
// ServerQuery and kept for a minute. 404 unless TeamSpeak is the voice server.
export function GET() {
  return api(async () => {
    const v = await getVoiceDetail();
    if (!v) return null;
    const { box, info } = v;
    return {
      name: box.name,
      type: box.type,
      country: box.country ? box.country.toUpperCase() : null,
      address: box.address,
      link: box.link,
      // Like the TeamSpeak banner: whether a password is needed, never the password itself.
      passwordProtected: !!box.password,
      online: v.ok,
      clients: box.clients,
      maxClients: box.max,
      channelCount: box.channels,
      showClients: v.showClients,
      info: info
        ? {
            uptime: info.uptime,
            created: info.created,
            version: info.version || null,
            os: info.os || null,
            clientConnections: info.clientConnections,
            queryConnections: info.queryConnections,
            securityLevel: info.securityLevel,
            ping: info.ping,
            packetLoss: info.packetLoss,
            bandwidthIn: info.bandwidthIn,
            bandwidthOut: info.bandwidthOut,
            bytesIn: info.bytesIn,
            bytesOut: info.bytesOut,
            hostBannerUrl: info.bannerUrl || null,
            welcome: info.welcome || null,
          }
        : null,
      channels: v.channels.map(channel),
      bannerUrl: apiPath("/voice/teamspeak/banner"),
    };
  });
}

function channel(c: VoiceChannel): unknown {
  return {
    id: c.id,
    name: c.name,
    spacer: c.spacer,
    topic: c.topic || null,
    password: c.password,
    clientCount: c.count,
    clients: c.clients.map((u) => ({ name: u.name, away: u.away, muted: u.muted, deaf: u.deaf, country: u.country ? u.country.toUpperCase() : null })),
    children: c.children.map(channel),
  };
}

// What the TeamSpeak banner shows, taken from the voice box (live ServerQuery
// data, no history). Only fields the public voice box and /voice page show
// anyway; the server password, the query login and the query port never
// reach the picture. Pure function without file access, so tests can run it.

export type VoiceBannerInput = {
  name: string;
  type: string;
  country: string | null;
  address: string;
  clients: number | null;
  max: number | null;
  channels: number | null;
  uptime: number | null;
};

export type VoiceBannerData = {
  name: string;
  type: string;
  country: string | null;
  address: string;
  // false: the query could not be read (offline or unreachable).
  online: boolean;
  clients: number | null;
  max: number | null;
  // Share of the slots in use, 0..1.
  share: number;
  channels: number | null;
  uptime: number | null;
};

export function voiceBannerData(ts: VoiceBannerInput): VoiceBannerData {
  const online = ts.clients !== null;
  const max = online ? ts.max : null;
  return {
    name: ts.name,
    type: ts.type,
    country: ts.country,
    address: ts.address,
    online,
    clients: online ? ts.clients : null,
    max,
    share: online && max ? Math.min(1, Math.max(0, (ts.clients ?? 0) / max)) : 0,
    channels: online ? ts.channels : null,
    uptime: online ? ts.uptime : null,
  };
}

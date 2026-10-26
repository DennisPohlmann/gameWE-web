import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import type { MapGateText } from "@/components/map-gate";
import { CONSENT_COOKIE, parseConsent, type Consent } from "./consent";
import { fill, getDict } from "./i18n";
import { tileProvider } from "./privacy-inventory";

// The visitor's consent from the request's cookie (lib/consent.ts), once per
// request: the layout and the page both ask.
export const getConsent = cache(async (): Promise<Consent> => parseConsent((await cookies()).get(CONSENT_COOKIE)?.value));

// What MapGate (components/map-gate.tsx) needs: whether the map may load
// and its texts with the tile provider of the chosen style.
export async function mapGateProps(style: string): Promise<{ allowed: boolean; t: MapGateText }> {
  const [consent, { t }] = await Promise.all([getConsent(), getDict()]);
  return {
    allowed: consent.maps,
    t: { blocked: fill(t.consent.mapBlocked, { provider: tileProvider(style).provider }), load: t.consent.mapLoad, always: t.consent.mapAlways },
  };
}

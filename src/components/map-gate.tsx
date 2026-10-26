"use client";

import { useEffect, useState, type ComponentProps } from "react";
import { AllowForm } from "@/components/consent";
import { PlayerMap } from "@/components/player-map";

export type MapGateText = { blocked: string; load: string; always: string };

// The player map only with consent to the "maps" category (lib/consent.ts):
// its tiles (and every other layer) come from other hosts. Without consent
// a box of the map's size says from where; "Load map" shows it this once
// (needs JavaScript, so the button only appears with it), "Always allow"
// stores the consent (a plain form, also without JavaScript).
export function MapGate({ allowed, t, ...map }: ComponentProps<typeof PlayerMap> & { allowed: boolean; t: MapGateText }) {
  const [once, setOnce] = useState(false);
  const [js, setJs] = useState(false);
  useEffect(() => setJs(true), []);
  if (allowed || once) return <PlayerMap {...map} />;
  return (
    <div className="player-map map-consent">
      <p>{t.blocked}</p>
      <div className="map-consent-buttons">
        {js ? (
          <button type="button" className="button" onClick={() => setOnce(true)}>
            {t.load}
          </button>
        ) : null}
        <AllowForm category="maps" label={t.always} />
      </div>
    </div>
  );
}

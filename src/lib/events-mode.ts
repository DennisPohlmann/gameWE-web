// How the event boxes on the public pages behave (Admin → Settings): live
// (sync, new events flow in), static (async, as of loading the page) or off
// (not shown). Kept apart from lib/settings.ts so the tests can load it.
export type EventsMode = "live" | "static" | "off";

// The stored value of gamewe_game_events / gamewe_player_events; unknown or
// empty: live, the default.
export function eventsMode(v: string | undefined): EventsMode {
  const s = v?.trim();
  return s === "static" || s === "off" ? s : "live";
}

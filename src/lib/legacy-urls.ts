// Old HLstatsX:CE addresses (hlstats.php?mode=…, ingame.php, sig.php,
// status.php) and where they live on this site. The modes and parameters
// are the ones of HLstatsX:CE's web/hlstats.php, web/ingame.php and
// web/pages/*.php. src/proxy.ts sends every path ending in one of these
// scripts here, also below an old folder (/hlstats/hlstats.php).

export const LEGACY_SCRIPTS = ["hlstats.php", "index.php", "ingame.php", "sig.php", "status.php"] as const;
export type LegacyScript = (typeof LEGACY_SCRIPTS)[number];

export type LegacyLookups = {
  // The ranking of a player, clan or server, null if there is none.
  gameOf(kind: "player" | "clan" | "server", id: number): Promise<string | null>;
  // The id of an action by its code (HLstatsX links name the code).
  actionId(game: string, code: string): Promise<number | null>;
};

const idOf = (v: string | null) => (v && /^\d{1,10}$/.test(v) && Number(v) > 0 ? Number(v) : null);
const gameParam = (v: string | null) => (v && /^[A-Za-z0-9_.-]{1,32}$/.test(v) ? v : null);
const textParam = (v: string | null) => (v && v.length <= 128 ? encodeURIComponent(v) : null);

// HLstatsX's search names its fields player/uniqueid/clan, this site names/uniqueid/clans.
const SEARCH_IN: Record<string, string> = { player: "names", uniqueid: "uniqueid", clan: "clans" };

// The new path (without the base path) of an old address, null when the
// thing it names does not exist (then 404, so search engines drop it).
export async function legacyTarget(script: LegacyScript, q: URLSearchParams, look: LegacyLookups): Promise<string | null> {
  const game = gameParam(q.get("game"));
  const g = (path = "") => (game ? `/${game}${path}` : "/");
  const player = idOf(q.get("player")) ?? (script === "sig.php" ? idOf(q.get("player_id")) : null);

  if (script === "sig.php") return player ? `/sig/${player}.png` : null;
  if (script === "status.php") {
    const id = idOf(q.get("server_id"));
    const sg = id ? await look.gameOf("server", id) : null;
    return id && sg ? `/banner/${encodeURIComponent(sg)}/server/${id}.png` : null;
  }

  const playerPage = async (sub = "") => {
    if (!player) return null;
    const pg = await look.gameOf("player", player);
    return pg ? `/${encodeURIComponent(pg)}/players/${player}${sub}` : null;
  };
  const mode = q.get("mode") ?? "";

  // The in-game pages (MOTD window): a player's pages are its profile.
  if (script === "ingame.php") {
    if (["statsme", "kills", "targets", "accuracy", "weapons", "maps", "actions"].includes(mode) && player) return playerPage();
    if (["players", "clans", "weapons", "maps", "actions", "bans"].includes(mode)) return g(`/${mode}`);
    if (mode === "help") return "/help";
    if (!["claninfo", "weaponinfo", "mapinfo", "actioninfo"].includes(mode)) return g();
  }

  switch (mode) {
    case "players":
    case "clans":
    case "weapons":
    case "maps":
    case "actions":
    case "bans":
    case "chat":
      return g(`/${mode}`);
    case "countryclans":
    case "countryclansinfo":
      return g("/clans");
    case "roles":
    case "rolesinfo":
      return g("/teams");
    case "awards": {
      const tab = q.get("tab");
      return g(tab === "ranks" || tab === "ribbons" ? `/awards?view=${tab}` : "/awards");
    }
    case "globalawards":
    case "dailyawardinfo":
      return g("/awards");
    case "ranks":
    case "rankinfo":
      return g("/awards?view=ranks");
    case "ribbons":
    case "ribboninfo":
      return g("/awards?view=ribbons");
    case "playerinfo": {
      const uid = q.get("uniqueid");
      if (!player && uid && uid.length <= 64) {
        return `/search?${new URLSearchParams({ q: uid, st: "uniqueid", ...(game ? { game } : {}) })}`;
      }
      return playerPage();
    }
    case "playerhistory":
      return playerPage("/events");
    case "playersessions":
      return playerPage("/sessions");
    case "playerawards":
      return playerPage("/awards");
    case "chathistory":
      return playerPage("/chat");
    case "claninfo": {
      const id = idOf(q.get("clan"));
      const cg = id ? await look.gameOf("clan", id) : null;
      return id && cg ? `/${encodeURIComponent(cg)}/clans/${id}` : null;
    }
    case "servers": {
      const id = idOf(q.get("server_id"));
      if (!id) return g();
      const sg = await look.gameOf("server", id);
      return sg ? `/${encodeURIComponent(sg)}/servers/${id}` : null;
    }
    case "weaponinfo": {
      const w = textParam(q.get("weapon"));
      return game && w ? `/${game}/weapons/${w}` : g("/weapons");
    }
    case "mapinfo": {
      const m = textParam(q.get("map"));
      return game && m ? `/${game}/maps/${m}` : g("/maps");
    }
    case "actioninfo": {
      const code = q.get("action");
      const id = game && code && code.length <= 128 ? await look.actionId(game, code) : null;
      return id ? `/${game}/actions/${id}` : g("/actions");
    }
    case "search": {
      const out = new URLSearchParams();
      const text = q.get("q");
      if (text) out.set("q", text.slice(0, 64));
      const st = SEARCH_IN[q.get("st") ?? ""];
      if (st) out.set("st", st);
      if (game) out.set("game", game);
      return `/search${out.size ? `?${out}` : ""}`;
    }
    case "help":
      return "/help";
    case "teamspeak":
    case "ventrilo":
      return "/voice";
    case "admin":
      return "/admin";
    default:
      // contents, an unknown mode or none: the ranking's start page or the site's.
      return g();
  }
}

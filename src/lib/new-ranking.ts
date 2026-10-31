import { GAME_KINDS } from "./games";

// A new ranking is created from one choice, its game (e.g. Counter-Strike:
// Source). The template, whose weapons, actions, teams, roles, awards, ranks
// and ribbons it copies, is optional: by default the game's own ranking
// (the seeded css for css), else the first ranking of that game. A template
// of another game is refused (its weapons and actions would not fit the
// logs). The name defaults to the game's name. Run the tests with `npm test`.

export type NewRanking = { game: string; template: string; name: string };

// input: the form (game may be empty when the database has no realgame
// column or the API leaves it out: then the template's game is taken).
// bases: base game per ranking code (rankingBaseGames); order: the ranking
// codes in display order. Returns the values to save, or the field at fault.
export function resolveNewRanking(
  input: NewRanking,
  bases: ReadonlyMap<string, string | null>,
  order: readonly string[],
  hasGameColumn = true,
): NewRanking | { field: "realgame" | "template" } {
  const template = input.template.trim();
  if (template && !bases.has(template)) return { field: "template" };
  const tbase = template ? (bases.get(template) ?? null) : null;
  const game = (input.game.trim().toLowerCase() || tbase || "").trim();
  if (hasGameColumn && !game) return { field: "realgame" };
  if (game && !GAME_KINDS[game]) return { field: "realgame" };
  // The template must be of the same game (unknown ones are let through,
  // nothing to compare).
  if (template && tbase && game && tbase !== game) return { field: "template" };
  const fallback = !template && game ? (bases.get(game) === game ? game : (order.find((c) => bases.get(c) === game) ?? "")) : "";
  const name = input.name.trim() || (game ? GAME_KINDS[game].name : "");
  return { game, template: template || fallback, name };
}

// The template choices of the new-ranking form: rankings of a known game,
// labelled with it, as [code, label, game].
export function templateOptions(games: readonly [string, string][], bases: ReadonlyMap<string, string | null>): [string, string, string][] {
  return games.flatMap(([code, label]): [string, string, string][] => {
    const base = bases.get(code) ?? null;
    const kind = base ? GAME_KINDS[base] : undefined;
    return kind && !kind.retired ? [[code, `${label} – ${kind.short}`, base!]] : [];
  });
}

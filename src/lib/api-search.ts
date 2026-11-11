import "server-only";
import { bad, enumArg, textArg } from "./api-params";
import { codeOk } from "./api";
import { getGames, NAME_SEARCH_MIN } from "./data";

// Parameters of the search endpoints, as the website's search page takes
// them: q (names at least NAME_SEARCH_MIN characters, clans 2), optionally one ranking.
export async function searchArgs(q: { get(name: string): string | null }, kinds: readonly string[]) {
  const text = textArg(q, "q", 64);
  const by = enumArg(q, "in", kinds, kinds[0]);
  if (!text) throw bad("missing q: the text to search for");
  const min = by === "names" ? NAME_SEARCH_MIN : 2;
  if (by !== "steamid" && text.length < min) throw bad(`invalid q: at least ${min} characters`);
  const raw = q.get("game") ?? "";
  if (raw && !codeOk(raw)) throw bad("invalid game: code of a ranking");
  const games = await getGames(true);
  const game = raw && games.some((g) => g.code === raw) ? raw : "";
  if (raw && !game) throw bad("invalid game: code of a ranking as in /rankings");
  return { text, by, game };
}

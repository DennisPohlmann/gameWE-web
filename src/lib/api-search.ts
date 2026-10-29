import "server-only";
import { bad, enumArg, textArg } from "./api-params";
import { codeOk } from "./api";
import { getGames } from "./data";

// Parameters of the search endpoints, as the website's search page takes
// them: q (names and clans: at least 2 characters), optionally one ranking.
export async function searchArgs(q: { get(name: string): string | null }, kinds: readonly string[]) {
  const text = textArg(q, "q", 64);
  const by = enumArg(q, "in", kinds, kinds[0]);
  if (!text) throw bad("missing q: the text to search for");
  if (by !== "steamid" && text.length < 2) throw bad("invalid q: at least 2 characters");
  const raw = q.get("game") ?? "";
  if (raw && !codeOk(raw)) throw bad("invalid game: code of a ranking");
  const games = await getGames(true);
  const game = raw && games.some((g) => g.code === raw) ? raw : "";
  if (raw && !game) throw bad("invalid game: code of a ranking as in /rankings");
  return { text, by, game };
}

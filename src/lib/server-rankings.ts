import { isTemplateRanking } from "./ranking-template";

// The rankings a server can be put into (server form, server list filter,
// "Move to" on a ranking's page). A template (a seeded ranking without
// servers, ranking-template.ts) only holds the definitions for new rankings,
// so it is not offered; a ranking an admin created is, also before its first
// server. Run the tests with `npm test`.

// games: optionList("games"); withServers: codes of the rankings that have
// servers; keep: codes still listed, e.g. the server's current ranking, so
// the form shows it. Without any ranking with servers yet (fresh database)
// every ranking stays, or the first server could not be created.
export function serverRankingOptions(
  games: readonly [string, string][],
  withServers: ReadonlySet<string>,
  keep: readonly (string | null | undefined)[] = [],
): [string, string][] {
  if (!games.some(([c]) => withServers.has(c))) return [...games];
  return games.filter(([c]) => !isTemplateRanking(c, withServers.has(c) ? 1 : 0) || keep.includes(c));
}

import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty, GameTag, Pager, ROW_OPTIONS, Section, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { localeOf } from "@/lib/format";
import { listRows, optionList, withColumns } from "@/lib/admin-data";
import { allServers, rankingBaseGames } from "@/lib/admin-rankings";
import { RankBadge, rankName } from "@/components/badges";
import { getEntity, type Field } from "@/lib/admin-entities";
import { adminDict } from "@/lib/admin-i18n";
import { requireAdmin } from "@/lib/auth";
import { getAdminLang } from "@/lib/i18n";
import { listHref, withReturnTo } from "@/lib/return-to";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function EntityList({ params, searchParams }: { params: Promise<{ entity: string }>; searchParams: SP }) {
  const found = getEntity((await params).entity);
  if (!found) notFound();
  const e = await withColumns(found);
  await requireAdmin(e.minLevel);
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const sp = await searchParams;
  const game = strParam(sp.game);
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const size = rowsParam(sp.rows, 50);
  const [{ rows, total }, games, servers] = await Promise.all([
    listRows(e, { game: game || undefined, q: q || undefined, page, pageSize: size }),
    e.gameColumn ? optionList("games") : Promise.resolve([]),
    e.key === "games" ? allServers() : Promise.resolve([]),
  ]);
  // Base game of rankings and servers (realgame, or the code of a seeded game).
  const bases = e.key === "games" || e.key === "servers" ? await rankingBaseGames() : new Map<string, string | null>();
  const baseOf = (code: unknown) => bases.get(String(code ?? "").trim()) ?? null;
  // Rankings list how many servers they have.
  const serverCount = (code: unknown) => servers.filter((s) => s.game === String(code ?? "").trim()).length;
  // The ranking's game shows as its own column (with the fallback above).
  const cols = e.fields.filter((f) => f.inList && f.name !== "realgame");
  const gameCol = e.key === "games" || e.key === "servers";
  const base = `/admin/${e.key}`;
  // The edit page and its redirects come back to this list with its filters.
  const listParams = { game: game || undefined, q: q || undefined, page: page > 1 ? page : undefined, rows: size !== 50 ? size : undefined };
  const editHref = (id: string) => withReturnTo(`${base}/${encodeURIComponent(id)}`, listHref(e.key, listParams), e.key);

  return (
    <>
      <h1>{e.label[lang]}</h1>
      {e.help ? <p className="lead">{e.help[lang]}</p> : null}
      {sp.deleted ? <p className="notice">{a.deleted}</p> : null}
      <Section
        title={
          e.canCreate ? (
            <Link className="button" href={editHref("new")}>
              + {a.new}
            </Link>
          ) : (
            e.label[lang]
          )
        }
        aside={
          e.gameColumn || e.search ? (
            <Form className="search" action={base}>
              {e.gameColumn ? (
                <select {...noAutofill} name="game" defaultValue={game} aria-label={a.allGames}>
                  <option value="">{a.allGames}</option>
                  {games.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : null}
              {e.search ? <input {...noAutofill} type="search" name="q" defaultValue={q} aria-label={a.filter} /> : null}
              <button type="submit">{a.filter}</button>
            </Form>
          ) : null
        }
      >
        {rows.length ? (
          <>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    {cols.map((f) => (
                      <th key={f.name}>{f.label[lang]}</th>
                    ))}
                    {gameCol ? <th>{a.baseGame}</th> : null}
                    {e.key === "games" ? <th className="num">{a.serverCount}</th> : null}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={String(r.__pk)}>
                      {cols.map((f) => (
                        <td key={f.name}>
                          {e.key === "ranks" && f.name === "name" ? <RankCell name={String(r.name ?? "")} /> : show(f, r[f.name], lang)}
                        </td>
                      ))}
                      {gameCol ? (
                        <td>
                          {baseOf(e.key === "games" ? r.code : r.game) ? (
                            <GameTag realgame={baseOf(e.key === "games" ? r.code : r.game)} long />
                          ) : (
                            <Link className="muted" href={e.key === "games" ? editHref(String(r.__pk)) : `/admin/games`}>
                              {a.gameUnset}
                            </Link>
                          )}
                        </td>
                      ) : null}
                      {e.key === "games" ? (
                        <td className="num">
                          {serverCount(r.code) ? (
                            serverCount(r.code)
                          ) : (
                            <span className="game-tag template-tag" title={a.templateHint}>
                              {a.template}
                            </span>
                          )}
                        </td>
                      ) : null}
                      <td className="num">
                        <Link href={editHref(String(r.__pk))}>{a.edit}</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pager
              base={base}
              params={{ game: game || undefined, q: q || undefined, rows: size !== 50 ? size : undefined }}
              page={page}
              pages={Math.max(1, Math.ceil(total / size))}
              total={total}
              rows={{ value: size, options: ROW_OPTIONS }}
              locale={localeOf(lang)}
              labels={a.pager}
            />
          </>
        ) : (
          <Empty>-</Empty>
        )}
      </Section>
    </>
  );
}

// Rank insignia and readable name ({LANG_RANG_PVT} -> Private).
function RankCell({ name }: { name: string }) {
  const label = rankName(name);
  return (
    <span className="admin-rank">
      <RankBadge name={name} size={24} />
      {label}
      {label !== name ? <code className="muted">{name}</code> : null}
    </span>
  );
}

function show(f: Field, v: string | number | null, lang: "de" | "en") {
  if (v === null || v === undefined) return "";
  if (Array.isArray(f.options)) {
    const o = f.options.find(([k]) => k === String(v));
    if (o) return typeof o[1] === "string" ? o[1] : o[1][lang];
  }
  return String(v);
}

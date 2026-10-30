import Form from "next/form";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/admin/icons";
import { PageHead } from "@/components/admin/page-head";
import { Empty, GameIcon, GameTag, Pager, ROW_OPTIONS, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { localeOf } from "@/lib/format";
import { listRows, listSortColumn, optionList, withColumns } from "@/lib/admin-data";
import { sortHeads, SortInputs } from "@/components/sort-head";
import { sortState } from "@/lib/table-sort";
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
  const u = a.ui;
  const sp = await searchParams;
  const game = strParam(sp.game);
  const q = strParam(sp.q);
  const statusParam = strParam(sp.status);
  const status = e.statusFilter?.some((f) => f.value === statusParam) ? statusParam : "";
  const page = pageParam(sp.page);
  const size = rowsParam(sp.rows, 50);
  // Every list column that is a table column sorts the list; without a
  // choice it keeps the entity's order.
  // The ranking column says nothing while the list shows one ranking.
  const cols = e.fields.filter((f) => f.inList && f.name !== "realgame" && !(game && f.name === e.gameColumn));
  const sortable: Record<string, true> = { __default: true };
  for (const f of cols) if (listSortColumn(e, f.name)) sortable[f.name] = true;
  const order = sortState(sp, sortable, "__default");
  const [{ rows, total }, games, servers] = await Promise.all([
    listRows(e, { game: game || undefined, q: q || undefined, status: status || undefined, page, pageSize: size, sort: order.sort === "__default" ? undefined : order.sort, asc: order.asc }),
    e.gameColumn ? optionList("games") : Promise.resolve([]),
    e.key === "games" ? allServers() : Promise.resolve([]),
  ]);
  // Base game of rankings and servers (realgame, or the code of a seeded game).
  const bases = e.key === "games" || e.key === "servers" ? await rankingBaseGames() : new Map<string, string | null>();
  const baseOf = (code: unknown) => bases.get(String(code ?? "").trim()) ?? null;
  // Rankings list how many servers they have.
  const serverCount = (code: unknown) => servers.filter((s) => s.game === String(code ?? "").trim()).length;
  // The ranking's game shows as its own column (with the fallback above).
  const gameCol = e.key === "games" || e.key === "servers";
  const base = `/admin/${e.key}`;
  // The edit page and its redirects come back to this list with its filters.
  const listParams = { game: game || undefined, q: q || undefined, status: status || undefined, page: page > 1 ? page : undefined, rows: size !== 50 ? size : undefined, ...order.keep };
  const th = sortHeads(order, base, { ...listParams, page: undefined });
  const editHref = (id: string) => withReturnTo(`${base}/${encodeURIComponent(id)}`, listHref(e.key, listParams), e.key);
  const gameName = games.find(([v]) => v === game)?.[1];
  // The first list column is the row's name (a card title on phones).
  const mainCol = ["lastName", "name", "tag", "username", "code"].find((n) => cols.some((f) => f.name === n));
  const statusOf = (v: unknown) => e.statusFilter?.find((f) => f.value === statusValue(v));
  const area = e.key === "users" ? u.areaSettings : u.areaRankings;

  return (
    <>
      <PageHead
        crumbs={[[area, e.key === "users" ? "/admin/settings" : "/admin/rankings"], ...(gameName && e.gameColumn ? ([[gameName, `/admin/rankings/${encodeURIComponent(game)}`]] as [string, string][]) : []), [e.label[lang]]]}
        title={e.label[lang]}
        intro={
          <>
            {e.help ? e.help[lang] : null}
            {e.statusFilter ? <> {u.hiddenNote}</> : null}
          </>
        }
        actions={
          e.canCreate ? (
            <Link className="button primary" href={editHref("new")}>
              <Icon name="plus" />
              {a.new}
            </Link>
          ) : null
        }
      />
      {sp.deleted ? <p className="notice">{a.deleted}</p> : null}
      <section className="card">
        {e.gameColumn || e.search || e.statusFilter ? (
          <div className="toolbar">
            <Form action={base}>
              {e.search ? (
                <label className="searchbox">
                  <Icon name="search" />
                  <input {...noAutofill} type="search" name="q" defaultValue={q} placeholder={u.search} aria-label={a.filter} />
                </label>
              ) : null}
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
              {status ? <input type="hidden" name="status" value={status} /> : null}
              <SortInputs keep={order.keep} />
              <button type="submit" className="button">
                {a.filter}
              </button>
            </Form>
            {e.statusFilter ? (
              <span className="adm-seg" role="group" aria-label={u.status}>
                <Link href={listHref(e.key, { ...listParams, status: undefined, page: undefined })} className={status ? undefined : "on"}>
                  {u.stAll}
                </Link>
                {e.statusFilter.map((f) => (
                  <Link key={f.value} href={listHref(e.key, { ...listParams, status: f.value, page: undefined })} className={status === f.value ? "on" : undefined}>
                    {f.label[lang]}
                  </Link>
                ))}
              </span>
            ) : null}
          </div>
        ) : null}
        {rows.length ? (
          <>
            <TableWrap>
              <table className="cards">
                <thead>
                  <tr>
                    {cols.map((f) => (sortable[f.name] ? <Fragment key={f.name}>{th(f.label[lang], f.name, "")}</Fragment> : <th key={f.name}>{f.label[lang]}</th>))}
                    {gameCol ? <th>{a.baseGame}</th> : null}
                    {e.key === "games" ? <th className="num">{a.serverCount}</th> : null}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={String(r.__pk)}>
                      {cols.map((f) => (
                        <td key={f.name} className={f.name === mainCol ? "main" : undefined} data-l={f.name === mainCol || f.name === e.statusColumn ? undefined : `${f.label[lang]}:`}>
                          {e.key === "ranks" && f.name === "name" ? (
                            <RankCell name={String(r.name ?? "")} />
                          ) : f.name === e.statusColumn ? (
                            <StatusPill f={f} v={r[f.name]} filter={statusOf(r[f.name])} lang={lang} />
                          ) : f.name === mainCol ? (
                            <Link className="name" href={editHref(String(r.__pk))}>
                              {e.key === "servers" ? <GameIcon realgame={baseOf(r.game)} /> : null}
                              {show(f, r[f.name], lang) || "–"}
                            </Link>
                          ) : (
                            show(f, r[f.name], lang)
                          )}
                        </td>
                      ))}
                      {gameCol ? (
                        <td>
                          {baseOf(e.key === "games" ? r.code : r.game) ? (
                            <GameTag realgame={baseOf(e.key === "games" ? r.code : r.game)} long />
                          ) : (
                            <Link className="pill warn" href={e.key === "games" ? editHref(String(r.__pk)) : `/admin/rankings`}>
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
                            <span className="pill" title={a.templateHint}>
                              {a.template}
                            </span>
                          )}
                        </td>
                      ) : null}
                      <td className="end num">
                        <Link className="button small" href={editHref(String(r.__pk))}>
                          {a.edit}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pager
              base={base}
              params={{ ...listParams, page: undefined }}
              page={page}
              pages={Math.max(1, Math.ceil(total / size))}
              total={total}
              rows={{ value: size, options: ROW_OPTIONS }}
              locale={localeOf(lang)}
              labels={a.pager}
            />
          </>
        ) : (
          <Empty>{u.empty}</Empty>
        )}
      </section>
    </>
  );
}

// Value of the status column as the filter value it belongs to (players:
// hideranking 0 visible, 1 and 3 hidden, 2 banned).
function statusValue(v: unknown): string {
  const n = Number(v ?? 0);
  return n === 0 ? "visible" : n === 2 ? "banned" : "hidden";
}

function StatusPill({ f, v, filter, lang }: { f: Field; v: string | number | null; filter?: { label: { de: string; en: string }; tone?: string }; lang: "de" | "en" }) {
  return (
    <span className={`pill ${filter?.tone ?? ""}`} title={show(f, v, lang)}>
      {filter ? filter.label[lang] : show(f, v, lang)}
    </span>
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

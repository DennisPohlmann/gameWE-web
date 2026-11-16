import Form from "next/form";
import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/admin/icons";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { deleteAction } from "../../actions";
import { fill } from "@/lib/i18n";
import { PageHead } from "@/components/admin/page-head";
import { Empty, GameIcon, GameTag, Pager, ROW_OPTIONS, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { localeOf } from "@/lib/format";
import { listRows, listSortColumn, optionList, statusCounts, withColumns } from "@/lib/admin-data";
import { sortHeads, SortInputs } from "@/components/sort-head";
import { sortState } from "@/lib/table-sort";
import { allServers, rankingBaseGames } from "@/lib/admin-rankings";
import { RankBadge, rankName } from "@/components/badges";
import { getEntity, type Field, type L } from "@/lib/admin-entities";
import { adminDict, localized, tr } from "@/lib/admin-i18n";
import { PERM_T } from "@/lib/admin-texts";
import { listRoles } from "@/lib/admin-ops";
import { displayNames, requirePerm, withPerms, type AdminUser } from "@/lib/auth";
import { allowed } from "@/lib/admin-perms";
import { getAdminLang, type Lang } from "@/lib/i18n";
import { listHref, withReturnTo } from "@/lib/return-to";
import { isTemplateRanking } from "@/lib/ranking-template";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function EntityList({ params, searchParams }: { params: Promise<{ entity: string }>; searchParams: SP }) {
  const found = getEntity((await params).entity);
  if (!found) notFound();
  const e = await withColumns(found);
  const user = await requirePerm(e.perm.view);
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
  const [{ rows, total: listTotal }, games, servers, counts] = await Promise.all([
    listRows(e, { game: game || undefined, q: q || undefined, status: status || undefined, page, pageSize: size, sort: order.sort === "__default" ? undefined : order.sort, asc: order.asc, noTotal: !!e.statusFilter?.length }),
    // Players, clans and servers only exist in rankings with a server or a
    // player: the filter leaves the empty templates out; the definitions
    // (weapons, awards …) of a template can be edited, so all stay there.
    e.gameColumn ? optionList("games", ["players", "clans", "servers"].includes(e.key)) : Promise.resolve([]),
    e.key === "games" ? allServers() : Promise.resolve([]),
    statusCounts(e, { game: game || undefined, q: q || undefined }),
  ]);
  const total = e.statusFilter?.length ? (counts[e.statusFilter.some((f) => f.value === status) ? status : ""] ?? 0) : listTotal;
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
  const nfmt = (n: number) => n.toLocaleString(localeOf(lang));
  // Admins: what each may do at a glance (full admin, a role, own rights).
  const pt = localized(PERM_T, lang);
  const names = e.key === "users" ? await displayNames(rows.map((r) => String(r.__pk))) : null;
  const access = e.key === "users" ? new Map((await Promise.all(rows.map((r) => withPerms({ username: String(r.__pk), acclevel: Number(r.acclevel) })))).map((x) => [x.username, x])) : null;
  const accessRoles = access ? new Map((await listRoles()).map((r) => [r.id, r.name])) : new Map<string, string>();
  // Delete right in the row (as on the edit page, after a dialog); not for
  // rankings, which are managed on their own page.
  const rowDelete = e.canDelete && e.key !== "games" && allowed(user, e.perm.edit);

  return (
    <>
      <PageHead
        crumbs={[[area, e.key === "users" ? "/admin/settings" : "/admin/rankings"], ...(gameName && e.gameColumn ? ([[gameName, `/admin/rankings/${encodeURIComponent(game)}`]] as [string, string][]) : []), [tr(e.label, lang)]]}
        title={tr(e.label, lang)}
        intro={
          <>
            {e.help ? tr(e.help, lang) : null}
            {e.statusFilter ? <> {u.hiddenNote}</> : null}
          </>
        }
        actions={
          e.canCreate && allowed(user, e.perm.edit) ? (
            <Link prefetch={false} className="button primary" href={editHref("new")}>
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
                  <input {...noAutofill} type="search" name="q" dir="auto" defaultValue={q} placeholder={u.search} aria-label={a.filter} />
                </label>
              ) : null}
              {e.gameColumn ? (
                <select {...noAutofill} name="game" defaultValue={game} aria-label={a.allGames}>
                  <option value="">{a.allGames}</option>
                  {games.map(([v, l]) => (
                    <option key={v} value={v} dir="auto">
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
                <Link prefetch={false} href={listHref(e.key, { ...listParams, status: undefined, page: undefined })} className={status ? undefined : "on"}>
                  {u.stAll} <span className="n">{nfmt(counts[""] ?? 0)}</span>
                </Link>
                {e.statusFilter.map((f) => (
                  <Link prefetch={false} key={f.value} href={listHref(e.key, { ...listParams, status: f.value, page: undefined })} className={status === f.value ? "on" : undefined}>
                    {tr(f.label, lang)} <span className="n">{nfmt(counts[f.value] ?? 0)}</span>
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
                    {cols.map((f) => (sortable[f.name] ? <Fragment key={f.name}>{th(tr(f.label, lang), f.name, "")}</Fragment> : <th key={f.name}>{tr(f.label, lang)}</th>))}
                    {gameCol ? <th>{a.baseGame}</th> : null}
                    {e.key === "games" ? <th className="num">{a.serverCount}</th> : null}
                    {access ? <th>{pt.title}</th> : null}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={String(r.__pk)}>
                      {cols.map((f) => (
                        <td key={f.name} className={f.name === mainCol ? "main" : undefined} data-l={f.name === mainCol || f.name === e.statusColumn ? undefined : `${tr(f.label, lang)}:`}>
                          {e.key === "ranks" && f.name === "name" ? (
                            <RankCell name={String(r.name ?? "")} />
                          ) : f.name === e.statusColumn ? (
                            <StatusPill f={f} v={r[f.name]} filter={statusOf(r[f.name])} lang={lang} />
                          ) : f.name === mainCol ? (
                            <>
                              <Link prefetch={false} className="name" href={editHref(String(r.__pk))}>
                                {e.key === "servers" ? <GameIcon realgame={baseOf(r.game)} /> : null}
                                <bdi>{show(f, r[f.name], lang) || "–"}</bdi>
                              </Link>
                              {names?.get(String(r.__pk)) ? (
                                <small className="muted">
                                  {" "}
                                  <bdi>{names.get(String(r.__pk))}</bdi>
                                </small>
                              ) : null}
                            </>
                          ) : (
                            <bdi>{show(f, r[f.name], lang)}</bdi>
                          )}
                        </td>
                      ))}
                      {gameCol ? (
                        <td>
                          {baseOf(e.key === "games" ? r.code : r.game) ? (
                            <GameTag realgame={baseOf(e.key === "games" ? r.code : r.game)} long />
                          ) : (
                            <Link prefetch={false} className="pill warn" href={e.key === "games" ? editHref(String(r.__pk)) : `/admin/rankings`}>
                              {a.gameUnset}
                            </Link>
                          )}
                        </td>
                      ) : null}
                      {e.key === "games" ? (
                        <td className="num">
                          {serverCount(r.code) || !isTemplateRanking(String(r.code ?? ""), 0) ? (
                            serverCount(r.code)
                          ) : (
                            <span className="pill" title={a.templateHint}>
                              {a.template}
                            </span>
                          )}
                        </td>
                      ) : null}
                      {access ? (
                        <td data-l={`${pt.title}:`}>
                          <AccessCell a={access.get(String(r.__pk))} level={Number(r.acclevel)} pt={pt} roles={accessRoles} />
                        </td>
                      ) : null}
                      <td className="end num">
                        <span className="row-actions">
                          <Link prefetch={false} className="button small" href={editHref(String(r.__pk))}>
                            {a.edit}
                          </Link>
                          {rowDelete ? (
                            <form action={deleteAction}>
                              <input type="hidden" name="__entity" value={e.key} />
                              <input type="hidden" name="__id" value={String(r.__pk)} />
                              <input type="hidden" name="__returnTo" value={listHref(e.key, listParams)} />
                              <ConfirmButton
                                className="button small danger"
                                label={a.delete}
                                title={fill(a.deleteTitle, { n: String((mainCol ? r[mainCol] : null) ?? r.__pk) })}
                                yes={a.deleteYes}
                                text={{ cancel: a.confirmCancel }}
                                disabled={e.key === "users" && String(r.__pk) === user.username}
                              >
                                <p>{a.deleteBody}</p>
                              </ConfirmButton>
                            </form>
                          ) : null}
                        </span>
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

function StatusPill({ f, v, filter, lang }: { f: Field; v: string | number | null; filter?: { label: L; tone?: string }; lang: Lang }) {
  return (
    <span className={`pill ${filter?.tone ?? ""}`} title={show(f, v, lang)}>
      {filter ? tr(filter.label, lang) : show(f, v, lang)}
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

function show(f: Field, v: string | number | null, lang: Lang) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(f.options)) {
    const o = f.options.find(([k]) => k === String(v));
    if (o) return typeof o[1] === "string" ? o[1] : tr(o[1], lang);
  }
  return String(v);
}

// Full admin, the role's name or the number of own rights.
function AccessCell({ a, level, pt, roles }: { a?: AdminUser; level: number; pt: (typeof PERM_T)["de"]; roles: Map<string, string> }) {
  if (level >= 100) return <span className="pill ok">{pt.levelFull}</span>;
  if (a?.role) return <span className="pill"><bdi>{roles.get(a.role) ?? a.role}</bdi></span>;
  return <span className="pill">{fill(pt.roleRights, { n: String(a?.perms.length ?? 0) })}</span>;
}

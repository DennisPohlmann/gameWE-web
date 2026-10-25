import Link from "next/link";
import { notFound } from "next/navigation";
import { assignServersAction, deleteAction, moveServerAction, saveAction } from "../../../actions";
import { allServers, rankingBaseGames } from "@/lib/admin-rankings";
import { noAutofill } from "@/lib/autofill";
import { gameKind, sameBaseGame } from "@/lib/games";
import { PageHead } from "@/components/admin/page-head";
import { Section } from "@/components/ui";
import { getRow, optionList, withColumns } from "@/lib/admin-data";
import { RankBadge, rankName } from "@/components/badges";
import { getEntity } from "@/lib/admin-entities";
import { adminDict } from "@/lib/admin-i18n";
import { requireAdmin } from "@/lib/auth";
import { fill, getAdminLang } from "@/lib/i18n";
import { safeReturnTo } from "@/lib/return-to";

type SP = Promise<Record<string, string | undefined>>;

export default async function EntityEdit({ params, searchParams }: { params: Promise<{ entity: string; id: string }>; searchParams: SP }) {
  const { entity, id: rawId } = await params;
  const found = getEntity(entity);
  if (!found) notFound();
  const e = await withColumns(found);
  await requireAdmin(e.minLevel);
  const id = decodeURIComponent(rawId);
  const isNew = id === "new";
  if (isNew && !e.canCreate) notFound();
  const row = isNew ? {} : await getRow(e, id);
  if (!row) notFound();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const sp = await searchParams;
  // The list (ranking, search, page) this page was opened from.
  const returnTo = safeReturnTo(sp.returnTo, e.key);
  // Rankings are managed on /admin/rankings; their plain list is only the editor's.
  const back = e.key === "games" && returnTo === "/admin/games" ? "/admin/rankings" : returnTo;
  const r0 = row as Record<string, unknown>;
  const title = String(r0.lastName ?? r0.name ?? r0.tag ?? r0.username ?? r0.code ?? id);
  const optionSets = Object.fromEntries(
    await Promise.all(
      [...new Set(e.fields.map((f) => f.options).filter((o): o is "games" | "clans" => typeof o === "string"))].map(
        async (k) => [k, await optionList(k)] as const,
      ),
    ),
  );
  const badField = e.fields.find((f) => f.name === sp.field);
  const error =
    sp.error === "field"
      ? fill(a.invalidField, { f: badField?.label[lang] ?? sp.field ?? "" })
      : sp.error === "db"
        ? fill(a.dbWriteError, { msg: sp.msg ?? "" })
        : sp.error === "self"
          ? a.notSelf
          : sp.error === "mismatch"
            ? a.gameMismatch
            : sp.error === "duplicate"
              ? a.serverExists
              : null;
  // The existing server a duplicate points to.
  const dup = sp.error === "duplicate" && /^\d{1,5}$/.test(sp.dup ?? "") ? sp.dup : null;
  // A new row's input after an error (plain fields only, see keptValues).
  const kept = (name: string) => (isNew && sp.error ? sp[`v_${name}`] : undefined);

  return (
    <>
      <PageHead
        crumbs={[
          [e.key === "users" ? a.ui.areaSettings : a.ui.areaRankings, e.key === "users" ? "/admin/settings" : "/admin/rankings"],
          [e.label[lang], back],
          [isNew ? a.new : title],
        ]}
        title={isNew ? `${e.label[lang]}: ${a.new}` : title}
        actions={
          <Link className="button" href={back}>
            ← {a.back}
          </Link>
        }
      />
      {e.key === "games" && !e.fields.some((f) => f.name === "realgame") ? <p className="notice error">{a.realgameMissing}</p> : null}
      {e.key === "ranks" && !isNew && typeof (row as Record<string, unknown>).name === "string" ? (
        <p className="lead admin-rank">
          <RankBadge name={String((row as Record<string, unknown>).name)} size={36} />
          {rankName(String((row as Record<string, unknown>).name))}
        </p>
      ) : null}
      {sp.saved ? <p className="notice">{a.saved}</p> : null}
      {error ? (
        <p className="notice error">
          {error}
          {dup ? (
            <>
              {" "}
              <Link href={`/admin/servers/${dup}`}>{a.serverExistsOpen} →</Link>
            </>
          ) : null}
        </p>
      ) : null}
      <Section title={isNew ? a.new : a.edit}>
        <form action={saveAction} className="form">
          <input type="hidden" name="__entity" value={e.key} />
          <input type="hidden" name="__id" value={id} />
          <input type="hidden" name="__returnTo" value={returnTo} />
          {e.fields.filter((f) => isNew || !f.virtual).map((f) => {
            const value = kept(f.name) ?? (row as Record<string, string | number | null>)[f.name];
            const locked = f.readonly || (f.createOnly && !isNew);
            const opts = Array.isArray(f.options)
              ? f.options.map(([v, l]): [string, string] => [v, typeof l === "string" ? l : l[lang]])
              : f.options
                ? optionSets[f.options]
                : null;
            return (
              <label key={f.name}>
                {f.label[lang]}
                {opts && !locked ? (
                  <select {...noAutofill} name={f.name} defaultValue={value === null || value === undefined ? "" : String(value)} required={f.required}>
                    {!f.required || value === undefined ? <option value="" /> : null}
                    {opts.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                ) : f.type === "password" ? (
                  <input {...noAutofill} name={f.name} type="password" minLength={10} required={isNew} />
                ) : f.type === "secret" ? (
                  <input
                    {...noAutofill}
                    name={f.name}
                    type="password"
                    maxLength={f.max}
                    placeholder={(row as Record<string, unknown>)[`${f.name}__set`] ? "••••••••" : ""}
                  />
                ) : (
                  <input
                    {...noAutofill}
                    name={f.name}
                    defaultValue={value === null || value === undefined ? "" : String(value)}
                    type={f.type === "number" ? "number" : "text"}
                    inputMode={f.type === "decimal" ? "decimal" : undefined}
                    required={f.required && !locked}
                    readOnly={locked}
                    maxLength={f.max}
                  />
                )}
                {f.help ? <small className="muted">{f.help[lang]}</small> : null}
              </label>
            );
          })}
          <button type="submit" className="button">
            {a.save}
          </button>
        </form>
      </Section>
      {!isNew && e.key === "games" ? <RankingServers gameId={id} code={String((row as Record<string, unknown>).code ?? "").trim()} lang={lang} returnTo={returnTo} /> : null}
      {!isNew && e.canDelete ? (
        <Section title={a.delete}>
          <form action={deleteAction} className="form">
            <input type="hidden" name="__entity" value={e.key} />
            <input type="hidden" name="__id" value={id} />
            <input type="hidden" name="__returnTo" value={returnTo} />
            <label className="check">
              <input type="checkbox" name="confirm" value="1" required /> {a.deleteConfirm}
            </label>
            <button type="submit" className="button danger">
              {a.delete}
            </button>
          </form>
        </Section>
      ) : null}
    </>
  );
}

// Servers of a ranking, and a form to move other servers into it.
async function RankingServers({ gameId, code, lang, returnTo }: { gameId: string; code: string; lang: "de" | "en"; returnTo: string }) {
  const a = adminDict(lang);
  const [servers, games, bases] = await Promise.all([allServers(), optionList("games"), rankingBaseGames()]);
  // Servers only move between rankings of the same base game.
  const base = bases.get(code) ?? null;
  const fits = (c: string) => sameBaseGame(bases.get(c) ?? null, base);
  const gameName = (c: string) => gameKind(bases.get(c))?.short ?? "?";
  const targets = games.filter(([c]) => c !== code && fits(c));
  const mine = servers.filter((s) => s.game === code);
  const others = servers.filter((s) => s.game !== code);
  return (
    <Section id="servers" title={a.rankingServers}>
      {mine.length ? (
        <table>
          <tbody>
            {mine.map((s) => (
              <tr key={s.serverId}>
                <td>
                  <Link href={`/admin/servers/${s.serverId}`}>{s.name || `${s.address}:${s.port}`}</Link>
                </td>
                <td className="muted">
                  {s.address}:{s.port}
                </td>
                <td>
                  {targets.length ? (
                    <form action={moveServerAction} className="inline-form">
                      <input type="hidden" name="__id" value={gameId} />
                      <input type="hidden" name="__returnTo" value={returnTo} />
                      <input type="hidden" name="server" value={s.serverId} />
                      <select {...noAutofill} name="target" aria-label={a.rankingRemoveTo} defaultValue="">
                        <option value="" disabled>
                          {a.rankingRemoveTo} …
                        </option>
                        {targets.map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>{" "}
                      <button type="submit" className="button">
                        {a.rankingRemove}
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}>
                <small className="muted">{a.rankingRemoveHint}</small>
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <p>{a.rankingNoServers}</p>
      )}
      {others.length ? (
        <form action={assignServersAction} className="form box">
          <input type="hidden" name="__id" value={gameId} />
          <input type="hidden" name="__returnTo" value={returnTo} />
          <b>{a.rankingAddServers}</b>
          {others.map((s) => (
            <label key={s.serverId} className="check">
              <input type="checkbox" name="server" value={s.serverId} disabled={!fits(s.game)} /> {s.name || `${s.address}:${s.port}`}{" "}
              <span className="muted">
                ({a.rankingNow}: {s.game}, {gameName(s.game)}
                {fits(s.game) ? "" : ` · ${a.gameOther}`})
              </span>
            </label>
          ))}
          <small className="muted">{a.rankingMoveHint}</small>
          <button type="submit" className="button">
            {a.rankingAssign}
          </button>
        </form>
      ) : null}
    </Section>
  );
}

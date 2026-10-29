import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteAction, saveAction } from "../../../actions";
import { allServers, rankingBaseGames, rankingPageHref } from "@/lib/admin-rankings";
import { FieldControl } from "@/components/admin/field-control";
import { PageHead } from "@/components/admin/page-head";
import { Section } from "@/components/ui";
import { getRow, optionList, withColumns } from "@/lib/admin-data";
import { RankBadge, rankName } from "@/components/badges";
import { getEntity } from "@/lib/admin-entities";
import { adminDict } from "@/lib/admin-i18n";
import { requireAdmin } from "@/lib/auth";
import { fill, getAdminLang } from "@/lib/i18n";
import { presetRanking, rankingServersHref } from "@/lib/ranking-preset";
import { safeReturnTo } from "@/lib/return-to";
import { serverRankingOptions } from "@/lib/server-rankings";

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
  // A ranking is edited on its own page (/admin/rankings/<code>), which has
  // these fields with its servers and rules; old links and the notices of a
  // save go there.
  if (!isNew && e.key === "games") redirect(await rankingPageHref(id, await searchParams));
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const sp = await searchParams;
  // The list (ranking, search, page) this page was opened from.
  const returnTo = safeReturnTo(sp.returnTo, e.key);
  const r0 = row as Record<string, unknown>;
  const title = String(r0.lastName ?? r0.name ?? r0.tag ?? r0.username ?? r0.code ?? id);
  const optionSets = Object.fromEntries(
    await Promise.all(
      [...new Set(e.fields.map((f) => f.options).filter((o): o is "games" | "clans" => typeof o === "string"))].map(
        async (k) => [k, await optionList(k)] as const,
      ),
    ),
  );
  // A new server from a ranking's page ("Add server", ?game=): that ranking is
  // preset and locked, unknown codes are ignored.
  const preset = isNew && e.key === "servers" ? presetRanking(sp.game, (optionSets.games ?? []).map(([c]) => c)) : null;
  const presetLabel = preset ? (optionSets.games ?? []).find(([c]) => c === preset)?.[1] ?? preset : null;
  // Rankings are managed on /admin/rankings; their plain list is only the editor's.
  const back = preset ? rankingServersHref(preset) : e.key === "games" && returnTo === "/admin/games" ? "/admin/rankings" : returnTo;
  // Counter-Strike 2 servers log over HTTP and have no log secret.
  const serverGame = preset ?? (isNew ? "" : String(r0.game ?? "").trim());
  const cs2 = e.key === "servers" && serverGame !== "" && (await rankingBaseGames()).get(serverGame) === "cs2";
  // A server's ranking: no templates (rankings without servers), but always
  // the server's own one.
  const serverGames =
    e.key === "servers" && !preset
      ? serverRankingOptions(optionSets.games ?? [], new Set((await allServers()).map((s) => s.game)), [serverGame, isNew && sp.error ? sp.v_game : undefined])
      : null;
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
          [preset ? (presetLabel ?? preset) : e.label[lang], back],
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
      {cs2 ? <p className="notice">{fill(a.cs2LogHint, { port: String(Number(r0.port) || "<port>") })}</p> : null}
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
          {preset ? <input type="hidden" name="__ranking" value={preset} /> : null}
          {e.fields.filter((f) => (isNew ? !f.readonly : !f.virtual)).map((f) => {
            const value = (preset && f.name === "game" ? preset : kept(f.name)) ?? (row as Record<string, string | number | null>)[f.name];
            const locked = f.readonly || (f.createOnly && !isNew);
            // The preset ranking is the only choice (the save sets it anyway).
            const opts = Array.isArray(f.options)
              ? f.options.map(([v, l]): [string, string] => [v, typeof l === "string" ? l : l[lang]])
              : preset && f.name === "game"
                ? optionSets.games.filter(([c]) => c === preset)
                : serverGames && f.name === "game"
                  ? serverGames
                  : f.options
                  ? optionSets[f.options]
                  : null;
            // A secret has a switch of its own inside, so its block is no <label>.
            const Wrap = f.type === "secret" ? "div" : "label";
            return (
              <Wrap key={f.name} className={f.type === "secret" ? "form-field" : undefined}>
                {f.type === "secret" ? <label htmlFor={`f-${f.name}`}>{f.label[lang]}</label> : f.label[lang]}
                <FieldControl
                  f={f}
                  value={value}
                  opts={opts}
                  locked={Boolean(locked)}
                  isNew={isNew}
                  secretSet={Boolean((row as Record<string, unknown>)[`${f.name}__set`])}
                  lang={lang}
                />
                {preset && f.name === "game" ? (
                  <small className="muted">{fill(a.serverForRanking, { r: presetLabel ?? preset })}</small>
                ) : cs2 && f.name === "log_secret" ? (
                  <small className="muted">{a.cs2LogSecret}</small>
                ) : f.help ? (
                  <small className="muted">{f.help[lang]}</small>
                ) : null}
              </Wrap>
            );
          })}
          <button type="submit" className="button">
            {a.save}
          </button>
        </form>
      </Section>
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

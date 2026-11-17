import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteAction, deletePlayerAction, saveAction } from "../../../actions";
import { allServers, rankingBaseGames, rankingPageHref } from "@/lib/admin-rankings";
import { FieldControl } from "@/components/admin/field-control";
import { NewRankingSync } from "@/components/admin/new-ranking-sync";
import { PageHead } from "@/components/admin/page-head";
import { TokenGenerate } from "@/components/admin/token-generate";
import { Section } from "@/components/ui";
import { getRow, optionList, withColumns } from "@/lib/admin-data";
import { listRoles } from "@/lib/admin-ops";
import { RankBadge, rankName } from "@/components/badges";
import { getEntity, type Field } from "@/lib/admin-entities";
import { adminDict, localized, tr } from "@/lib/admin-i18n";
import { requirePerm, withPerms } from "@/lib/auth";
import { LEVEL80_DEFAULT, PERM_GROUPS, ROLE_PRESETS, allowed, normalizePerms } from "@/lib/admin-perms";
import { PERM_T } from "@/lib/admin-texts";
import { PermFields } from "@/components/admin/perm-fields";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { GAME_KINDS, sameBaseGame, SUPPORTED_GAMES } from "@/lib/games";
import { fill, getAdminLang } from "@/lib/i18n";
import { templateOptions } from "@/lib/new-ranking";
import { presetRanking, rankingServersHref } from "@/lib/ranking-preset";
import { safeReturnTo } from "@/lib/return-to";
import { serverRankingOptions } from "@/lib/server-rankings";

type SP = Promise<Record<string, string | undefined>>;

export default async function EntityEdit({ params, searchParams }: { params: Promise<{ entity: string; id: string }>; searchParams: SP }) {
  const { entity, id: rawId } = await params;
  const found = getEntity(entity);
  if (!found) notFound();
  const e = await withColumns(found);
  const user = await requirePerm(e.perm.view);
  // Without the right to change, the page only shows the row.
  const canEdit = allowed(user, e.perm.edit);
  const id = decodeURIComponent(rawId);
  const isNew = id === "new";
  if (isNew && (!e.canCreate || !canEdit)) notFound();
  const row = isNew ? {} : await getRow(e, id);
  if (!row) notFound();
  // A ranking is edited on its own page (/admin/rankings/<code>), which has
  // these fields with its servers and rules; old links and the notices of a
  // save go there.
  if (!isNew && e.key === "games") redirect(await rankingPageHref(id, await searchParams));
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const pt = localized(PERM_T, lang);
  const sp = await searchParams;
  // The rights of a level 80 admin (stored, or the old level 80 rights).
  // An admin with a role: its id (the boxes show the role's rights).
  const stored = e.key === "users" && !isNew ? await withPerms({ username: id, acclevel: 80 }) : null;
  const userPerms = e.key === "users" ? (stored ? stored.perms : LEVEL80_DEFAULT) : [];
  const roles = e.key === "users" ? await listRoles() : [];
  // The list (ranking, search, page) this page was opened from.
  const returnTo = safeReturnTo(sp.returnTo, e.key);
  const r0 = row as Record<string, unknown>;
  const title = String(r0.lastName ?? r0.name ?? r0.tag ?? r0.username ?? r0.code ?? id);
  const canErase = e.key === "players" && allowed(user, "players.erase");
  // Nobody deletes their own account (the server refuses it too).
  const canDelete = e.canDelete && canEdit && !(e.key === "users" && id === user.username);
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
  // Counter-Strike 2 servers log over HTTP: a log token instead of a log secret.
  const serverGame = preset ?? (isNew ? "" : String(r0.game ?? "").trim());
  const baseGame = e.key === "servers" && serverGame !== "" ? (await rankingBaseGames()).get(serverGame) : undefined;
  const cs2 = baseGame === "cs2";
  // A Source server's sv_logsecret can be generated too (GoldSrc sends none).
  const sourceSecret = baseGame !== undefined && GAME_KINDS[baseGame as keyof typeof GAME_KINDS]?.engine === "source";
  // A server's ranking: no templates (rankings without servers), but always
  // the server's own one.
  // An existing server only moves into a ranking of its own game.
  const bases = e.key === "servers" || (e.key === "games" && isNew) ? await rankingBaseGames() : null;
  const serverGames =
    e.key === "servers" && !preset
      ? serverRankingOptions(optionSets.games ?? [], new Set((await allServers()).map((s) => s.game)), [serverGame, isNew && sp.error ? sp.v_game : undefined]).filter(
          ([c]) => isNew || c === serverGame || sameBaseGame(bases?.get(c), bases?.get(serverGame)),
        )
      : null;
  // A new ranking: the game is the one choice; the template (optional) only
  // lists rankings of a game, the name defaults to the game's name.
  const newRanking = e.key === "games" && isNew;
  const templates = newRanking ? templateOptions(optionSets.games ?? [], bases!) : [];
  const createField = (f: Field): Field =>
    !newRanking ? f : f.name === "realgame" ? { ...f, required: true } : f.name === "name" ? { ...f, required: false } : f;
  const badField = e.fields.find((f) => f.name === sp.field);
  const error =
    newRanking && sp.error === "field" && sp.field === "template"
      ? a.templateOtherGame
      : sp.error === "field"
      ? sp.field === "inactive"
        ? a.inactiveNoRight
        : fill(a.invalidField, { f: cs2 && sp.field === "log_secret" ? a.cs2LogToken : sp.field === "role" && e.key === "users" ? pt.rolePick : (badField ? tr(badField.label, lang) : (sp.field ?? "")) })
      : sp.error === "db"
        ? fill(a.dbWriteError, { msg: sp.msg ?? "" })
        : sp.error === "self"
          ? a.notSelf
          : sp.error === "lastadmin"
            ? pt.lastAdmin
          : sp.error === "perm"
            ? pt.notOwn
          : sp.error === "password"
            ? a.pwOwnOnly
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
          [preset ? (presetLabel ?? preset) : tr(e.label, lang), back],
          [isNew ? a.new : title],
        ]}
        title={isNew ? `${tr(e.label, lang)}: ${a.new}` : title}
        actions={
          <Link prefetch={false} className="button" href={back}>
            ← {a.back}
          </Link>
        }
      />
      {e.key === "games" && !e.fields.some((f) => f.name === "realgame") ? <p className="notice error">{a.realgameMissing}</p> : null}
      {newRanking ? <p className="lead">{a.newRankingIntro}</p> : null}
      {e.key === "ranks" && !isNew && typeof (row as Record<string, unknown>).name === "string" ? (
        <p className="lead admin-rank">
          <RankBadge name={String((row as Record<string, unknown>).name)} size={36} />
          {rankName(String((row as Record<string, unknown>).name))}
        </p>
      ) : null}
      {sp.saved ? <p className="notice">{a.saved}</p> : null}
      {canEdit ? null : <p className="notice">{pt.readOnly}</p>}
      {cs2 ? <p className="notice">{fill(a.cs2LogHint, { port: String(Number(r0.port) || "<port>") })}</p> : null}
      {error ? (
        <p className="notice error">
          {error}
          {dup ? (
            <>
              {" "}
              <Link prefetch={false} href={`/admin/servers/${dup}`}>{a.serverExistsOpen} →</Link>
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
          <fieldset className="adm-ro form" disabled={!canEdit}>
          {/* An existing user's password is changed only by that user (My account). */}
          {e.fields.filter((f) => (isNew ? !f.readonly : !f.virtual && f.type !== "password")).map((f) => {
            const value = (preset && f.name === "game" ? preset : kept(f.name)) ?? (row as Record<string, string | number | null>)[f.name];
            const locked = f.readonly || (f.createOnly && !isNew);
            // The preset ranking is the only choice (the save sets it anyway).
            const opts = newRanking && f.name === "realgame"
              ? SUPPORTED_GAMES.map((k): [string, string] => [k, `${GAME_KINDS[k].name} (${k})${GAME_KINDS[k].limited ? ` – ${a.gameLimited}` : ""}`])
              : newRanking && f.name === "template"
                ? templates.map(([c, l]): [string, string] => [c, l])
              : Array.isArray(f.options)
              ? f.options.map(([v, l]): [string, string] => [v, typeof l === "string" ? l : tr(l, lang)])
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
                {f.type === "secret" ? <label htmlFor={`f-${f.name}`}>{cs2 && f.name === "log_secret" ? a.cs2LogToken : tr(f.label, lang)}</label> : tr(f.label, lang)}
                <FieldControl
                  f={createField(f)}
                  id={newRanking ? `f-${f.name}` : undefined}
                  emptyLabel={newRanking && f.name === "realgame" ? a.gameUnset : newRanking && f.name === "template" ? a.templateDefault : undefined}
                  value={value}
                  opts={opts}
                  locked={Boolean(locked)}
                  isNew={isNew}
                  secretSet={Boolean((row as Record<string, unknown>)[`${f.name}__set`])}
                  reveal={isNew ? undefined : `entity:${e.key}:${id}:${f.name}`}
                  lang={lang}
                />
                {preset && f.name === "game" ? (
                  <small className="muted">{fill(a.serverForRanking, { r: presetLabel ?? preset })}</small>
                ) : cs2 && f.name === "log_secret" ? (
                  <>
                    <TokenGenerate target={`f-${f.name}`} label={a.cs2LogTokenNew} copy={a.tokCopy} copied={a.tokCopied} />
                    <small className="muted">{a.cs2LogSecret}</small>
                  </>
                ) : sourceSecret && f.name === "log_secret" ? (
                  <>
                    <TokenGenerate target={`f-${f.name}`} label={a.logSecretNew} copy={a.tokCopy} copied={a.tokCopied} numeric />
                    {f.help ? <small className="muted">{tr(f.help, lang)}</small> : null}
                  </>
                ) : newRanking && f.name === "name" ? (
                  <small className="muted">{a.nameFromGame}</small>
                ) : f.help ? (
                  <small className="muted">{tr(f.help, lang)}</small>
                ) : null}
              </Wrap>
            );
          })}
          {e.key === "users" && !isNew ? <small className="muted">{a.pwOwnOnly}</small> : null}
          {e.key === "users" ? (
            <div className="form-field">
              <b>{pt.title}</b>
              <small className="muted">
                {pt.intro} {pt.implied}
              </small>
              <input type="hidden" name="__perms" value="1" />
              <PermFields
                initial={userPerms}
                groups={PERM_GROUPS.map((g) => ({ id: g.id, legend: pt.groups[g.id], perms: g.perms.map((p) => ({ id: p, label: pt.perm[p] })) }))}
                presets={ROLE_PRESETS.map((p) => ({ id: p.id, name: pt.preset[p.id as keyof typeof pt.preset], perms: normalizePerms(p.perms) }))}
                roles={roles.map((r) => ({ id: r.id, name: r.name, perms: r.perms }))}
                initialRole={stored?.role ?? null}
                text={{
                  full: pt.full,
                  presets: pt.presets,
                  presetsHint: pt.presetsHint,
                  access: pt.access,
                  modeRole: pt.modeRole,
                  modeRoleHint: pt.modeRoleHint,
                  modeOwn: pt.modeOwn,
                  rolePick: pt.rolePick,
                  noRoles: pt.noRoles,
                  rolesManage: pt.rolesManage,
                }}
              />
            </div>
          ) : null}
          {newRanking ? (
            <NewRankingSync
              templates={Object.fromEntries(templates.map(([c, , g]) => [c, g]))}
              names={Object.fromEntries(SUPPORTED_GAMES.map((k) => [k, GAME_KINDS[k].name]))}
            />
          ) : null}
          {canEdit ? (
            <button type="submit" className="button">
              {a.save}
            </button>
          ) : null}
          </fieldset>
        </form>
      </Section>
      {/* At the bottom just the button; the dialog asks for the name. */}
      {!isNew && (canErase || canDelete) ? (
        <div className="delete-row">
          {canErase ? (
            <form action={deletePlayerAction}>
              <input type="hidden" name="id" value={id} />
              <ConfirmButton
                label={a.deletePlayer}
                title={fill(a.deletePlayerTitle, { n: title })}
                yes={a.deletePlayer}
                typed={title.trim() || id}
                text={{ cancel: a.confirmCancel, typeHint: a.confirmTyped }}
              />
            </form>
          ) : null}
          {canDelete ? (
            <form action={deleteAction}>
              <input type="hidden" name="__entity" value={e.key} />
              <input type="hidden" name="__id" value={id} />
              <input type="hidden" name="__returnTo" value={returnTo} />
              <ConfirmButton
                label={a.delete}
                title={fill(a.deleteTitle, { n: title })}
                yes={a.delete}
                typed={title.trim() || id}
                text={{ cancel: a.confirmCancel, typeHint: a.confirmTyped }}
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteRoleAction, saveRoleAction } from "../../../actions";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { PageHead } from "@/components/admin/page-head";
import { PermFields } from "@/components/admin/perm-fields";
import { Section } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { adminDict, localized } from "@/lib/admin-i18n";
import { getRole } from "@/lib/admin-ops";
import { PERM_GROUPS, ROLE_PRESETS, isRoleId, normalizePerms } from "@/lib/admin-perms";
import { PERM_T } from "@/lib/admin-texts";
import { requirePerm } from "@/lib/auth";
import { fill, getAdminLang } from "@/lib/i18n";

// One admin role: its name and rights (the same boxes as on an admin's
// page), the admins who have it, and deleting it once nobody has it.
export default async function RolePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; error?: string }> }) {
  await requirePerm("admin");
  const { id } = await params;
  const isNew = id === "new";
  const role = isNew ? null : isRoleId(id) ? await getRole(id) : null;
  if (!isNew && !role) notFound();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const pt = localized(PERM_T, lang);
  const { saved, error } = await searchParams;
  const msg = { field: pt.roleErrName, duplicate: pt.roleErrDuplicate, limit: pt.roleErrLimit, inuse: pt.roleErrInuse, perm: pt.notOwn }[error ?? ""];
  const title = role?.name ?? pt.roleNew;
  return (
    <>
      <PageHead
        crumbs={[[a.ui.areaSettings, "/admin/settings"], [pt.rolesTitle, "/admin/admin-roles"], [title]]}
        title={title}
        actions={
          <Link prefetch={false} className="button" href="/admin/admin-roles">
            ← {a.back}
          </Link>
        }
      />
      {saved ? <p className="notice">{a.saved}</p> : null}
      {msg ? <p className="notice error">{msg}</p> : null}
      <Section title={isNew ? pt.roleNew : a.edit}>
        <form action={saveRoleAction} className="form">
          <input type="hidden" name="id" value={id} />
          <label>
            {a.tokName}
            <input {...noAutofill} name="name" dir="auto" maxLength={40} required defaultValue={role?.name ?? ""} />
            <small>{pt.roleNameHint}</small>
          </label>
          <div className="form-field">
            <b>{pt.title}</b>
            <small className="muted">{pt.implied}</small>
            <PermFields
              initial={role?.perms ?? []}
              groups={PERM_GROUPS.map((g) => ({ id: g.id, legend: pt.groups[g.id], perms: g.perms.map((p) => ({ id: p, label: pt.perm[p] })) }))}
              presets={ROLE_PRESETS.map((p) => ({ id: p.id, name: pt.preset[p.id as keyof typeof pt.preset], perms: normalizePerms(p.perms) }))}
              text={{ full: pt.full, presets: pt.presets, presetsHint: pt.presetsHint }}
            />
          </div>
          <button type="submit" className="button">
            {a.save}
          </button>
        </form>
      </Section>
      {role ? (
        <Section title={pt.roleAdmins}>
          <p className="muted">{role.admins.length ? role.admins.map((n, i) => [i ? ", " : "", <bdi key={n}>{n}</bdi>]) : pt.roleNoAdmins}</p>
        </Section>
      ) : null}
      {role ? (
        <form action={deleteRoleAction} className="delete-row">
          <input type="hidden" name="id" value={role.id} />
          <ConfirmButton
            label={a.delete}
            title={fill(pt.roleDeleteTitle, { n: role.name })}
            yes={a.delete}
            typed={role.name}
            text={{ cancel: a.confirmCancel, typeHint: a.confirmTyped }}
            disabled={role.admins.length > 0}
          />
          {role.admins.length ? <small className="muted">{pt.roleErrInuse}</small> : null}
        </form>
      ) : null}
    </>
  );
}

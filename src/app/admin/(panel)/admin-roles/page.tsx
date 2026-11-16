import Link from "next/link";
import { PageHead } from "@/components/admin/page-head";
import { Icon } from "@/components/admin/icons";
import { Empty } from "@/components/ui";
import { adminDict, localized } from "@/lib/admin-i18n";
import { listRoles } from "@/lib/admin-ops";
import { PERM_GROUPS } from "@/lib/admin-perms";
import { PERM_T } from "@/lib/admin-texts";
import { requirePerm } from "@/lib/auth";
import { fill, getAdminLang } from "@/lib/i18n";

// Admin roles (level 100 only): every role with its rights by area and the
// admins who have it; a role opens its page.
export default async function RolesPage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  await requirePerm("admin");
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const pt = localized(PERM_T, lang);
  const { deleted } = await searchParams;
  const roles = await listRoles();
  return (
    <>
      <PageHead
        crumbs={[[a.ui.areaSettings, "/admin/settings"], [a.ui.navAccess], [pt.rolesTitle]]}
        title={pt.rolesTitle}
        intro={pt.rolesIntro}
        actions={
          <Link prefetch={false} className="button primary" href="/admin/admin-roles/new">
            <Icon name="plus" />
            {pt.roleNew}
          </Link>
        }
      />
      {deleted ? <p className="notice">{pt.roleDeleted}</p> : null}
      {roles.length ? (
        <ul className="role-list">
          {roles.map((r) => (
            <li key={r.id} className="card">
              <Link prefetch={false} href={`/admin/admin-roles/${r.id}`} className="role-head">
                <b dir="auto">{r.name}</b>
                <span className="pill">{fill(pt.roleRights, { n: String(r.perms.length) })}</span>
              </Link>
              <div className="role-groups">
                {PERM_GROUPS.filter((g) => g.perms.some((p) => r.perms.includes(p))).map((g) => (
                  <span key={g.id} className="pill ok">
                    {pt.groups[g.id]}
                  </span>
                ))}
              </div>
              <small className="muted">
                {pt.roleAdmins}: {r.admins.length ? r.admins.map((n, i) => [i ? ", " : "", <bdi key={n}>{n}</bdi>]) : pt.roleNoAdmins}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <section className="card">
          <Empty>{pt.roleNone}</Empty>
        </section>
      )}
    </>
  );
}

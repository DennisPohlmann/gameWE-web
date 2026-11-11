import Link from "next/link";
import type { ReactNode } from "react";
import { adminDict } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/i18n";

// Heading of an admin page: breadcrumbs, title, one line of help and the
// page's buttons. A crumb with the same label as the next one is left out
// (Settings › Admin area › Admin area).
export async function PageHead({
  crumbs,
  title,
  intro,
  actions,
  badge,
}: {
  crumbs?: [string, string?][];
  title: ReactNode;
  intro?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  const trail = (crumbs ?? []).filter(([label], i, all) => label !== all[i + 1]?.[0]);
  const u = adminDict(await getAdminLang()).ui;
  return (
    <>
      {trail.length ? (
        <nav className="crumbs" aria-label={u.crumbsLabel}>
          <ol>
            {trail.map(([label, href], i) => (
              <li key={i} aria-current={i === trail.length - 1 ? "page" : undefined}>
                {href && i < trail.length - 1 ? <Link prefetch={false} href={href}>{label}</Link> : <span>{label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="page-head">
        {badge}
        <div>
          <h1>{title}</h1>
          {intro ? <p>{intro}</p> : null}
        </div>
        {actions ? <div className="actions">{actions}</div> : null}
      </div>
    </>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

// Heading of an admin page: breadcrumbs, title, one line of help and the
// page's buttons.
export function PageHead({
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
  return (
    <>
      {crumbs?.length ? (
        <p className="crumbs">
          {crumbs.map(([label, href], i) => (
            <span key={i}>
              {i ? "› " : ""}
              {href ? <Link href={href}>{label}</Link> : label}
            </span>
          ))}
        </p>
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

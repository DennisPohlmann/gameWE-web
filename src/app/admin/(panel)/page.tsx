import Link from "next/link";
import { Section } from "@/components/ui";
import { entities } from "@/lib/admin-entities";
import { adminDict } from "@/lib/admin-i18n";
import { requireAdmin } from "@/lib/auth";
import { adminQuery } from "@/lib/db";
import { getAdminLang } from "@/lib/i18n";

export default async function AdminHome() {
  const user = await requireAdmin();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const visible = entities.filter((e) => user.acclevel >= (e.minLevel ?? 0));
  const counts = await Promise.all(
    visible.map((e) =>
      adminQuery<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${e.table}${e.fixed ? ` WHERE ${Object.keys(e.fixed).map((k) => `${k} = ?`).join(" AND ")}` : ""}`,
        Object.values(e.fixed ?? {}),
      ).then((r) => r[0].n),
    ),
  );
  return (
    <>
      <h1>{a.dashboard}</h1>
      <p className="lead">{a.dashIntro}</p>
      <div className="servers">
        {visible.map((e, i) => (
          <article key={e.key} className="server-card">
            <h3>
              <Link href={`/admin/${e.key}`}>{e.label[lang]}</Link>
            </h3>
            <div className="meta">
              <span>
                {counts[i].toLocaleString(lang)} {a.rows}
              </span>
            </div>
            {e.help ? <p className="muted small">{e.help[lang]}</p> : null}
          </article>
        ))}
      </div>
      <p className="muted small">{a.readOnlyDb}</p>
    </>
  );
}

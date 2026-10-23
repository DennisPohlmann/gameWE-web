import { existsSync } from "node:fs";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "../actions";
import { entities } from "@/lib/admin-entities";
import { adminDict } from "@/lib/admin-i18n";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { fill, getAdminLang, getDict } from "@/lib/i18n";

// Menu groups: Website (settings, all options, chat), Rankings & statistics,
// Access (users).
const RANKING_ENTITIES = ["games", "servers", "players", "clans", "weapons", "actions", "teams", "roles", "awards", "ranks"];

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const { t } = await getDict();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const entityLink = (key: string) => {
    const e = entities.find((x) => x.key === key);
    return e && user.acclevel >= (e.minLevel ?? 0) ? (
      <Link key={e.key} href={`/admin/${e.key}`}>
        {e.label[lang]}
      </Link>
    ) : null;
  };
  return (
    <div className="admin">
      <aside className="admin-nav">
        <Link href="/admin" className="admin-title">
          {a.admin}
        </Link>
        <nav>
          <span className="admin-group">{a.navWebsite}</span>
          <Link href="/admin/settings">{a.settings}</Link>
          {entityLink("options")}
          <Link href="/admin/chat">{t.chat}</Link>
          <Link href="/admin/ips">{a.ips}</Link>
          <span className="admin-group">{a.navRankings}</span>
          {RANKING_ENTITIES.map(entityLink)}
          {user.acclevel >= LEVEL_ADMIN ? <Link href="/admin/reset">{lang === "de" ? "Ranking zurücksetzen" : "Reset ranking"}</Link> : null}
          {user.acclevel >= LEVEL_ADMIN ? (
            <>
              <span className="admin-group">{a.navUsers}</span>
              {entityLink("users")}
            </>
          ) : null}
        </nav>
        <div className="admin-user">
          <span className="muted">{fill(a.loggedInAs, { u: user.username })}</span>
          <Link href="/admin/account">{a.account}</Link>
          <Link href="/">{a.toSite}</Link>
          <form action={logoutAction}>
            <button type="submit" className="linkish">
              {a.logout}
            </button>
          </form>
        </div>
        {/* Which build runs here, for debugging. */}
        <p className="admin-version muted">
          gameWE web {process.env.APP_VERSION ? `v${process.env.APP_VERSION}` : "?"}
          <br />
          {inDocker() ? "Docker" : lang === "de" ? "ohne Docker (Node.js)" : "no Docker (Node.js)"}
        </p>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}

// GAMEWE_DOCKER is set in the image (Dockerfile); /.dockerenv covers other images.
function inDocker() {
  return process.env.GAMEWE_DOCKER === "1" || existsSync("/.dockerenv");
}

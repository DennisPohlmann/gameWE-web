import { existsSync } from "node:fs";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { adminThemeAction, logoutAction } from "../actions";
import { Icon } from "@/components/admin/icons";
import { AdminSidebar, AreaTabs, Logo, type NavText } from "@/components/admin/nav";
import { entities } from "@/lib/admin-entities";
import { adminDict } from "@/lib/admin-i18n";
import { rankingSummaries } from "@/lib/admin-rankings";
import { settingGroups } from "@/lib/admin-settings";
import { ADMIN_THEMES, getAdminTheme } from "@/lib/admin-theme";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { basePath } from "@/lib/base-path";
import { gameKind } from "@/lib/games";
import { getAdminLang, getDict } from "@/lib/i18n";

// Frame of every admin page after the login: top bar with the three areas
// and the user menu, the side menu of the area (a drawer on phones, opened
// by the checkbox #adm-nav without script) and a bottom bar on phones.
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const [{ t: site }, lang, theme, rankings] = await Promise.all([getDict(), getAdminLang(), getAdminTheme(), rankingSummaries()]);
  const a = adminDict(lang);
  const u = a.ui;
  const label = (key: string) => entities.find((e) => e.key === key)?.label[lang] ?? key;
  const text: NavText = {
    ...Object.fromEntries(Object.entries(u).filter(([, v]) => typeof v === "string")),
    toSite: a.toSite,
    logout: a.logout,
    servers: label("servers"),
    players: label("players"),
    clans: label("clans"),
    weapons: label("weapons"),
    actions: label("actions"),
    teams: label("teams"),
    roles: label("roles"),
    awards: label("awards"),
    ranks: label("ranks"),
    users: label("users"),
    chat: site.chat,
    ips: a.ips,
  } as NavText;
  const isAdmin = user.acclevel >= LEVEL_ADMIN;
  const footer = [`gameWE web ${process.env.APP_VERSION ? `v${process.env.APP_VERSION}` : "?"}`, inDocker() ? "Docker" : u.noDocker];
  const themeIcon = { auto: "auto", light: "sun", dark: "moon" } as const;
  const themeLabel = { auto: u.themeAuto, light: u.themeLight, dark: u.themeDark };

  return (
    <>
      <input type="checkbox" id="adm-nav" className="adm-nav-toggle" aria-hidden="true" tabIndex={-1} />
      <header className="adm-top">
        <label htmlFor="adm-nav" className="adm-icon-btn adm-burger" aria-label={u.menu}>
          <Icon name="menu" />
        </label>
        <Link href="/admin" className="adm-brand">
          <Logo />
          <span>
            game<b>WE</b>
          </span>
          <small>Admin</small>
        </Link>
        <Suspense>
          <AreaTabs t={text} className="adm-areas" />
        </Suspense>
        <span className="adm-spacer" />
        <a className="adm-tool adm-hide-m" href={`${basePath}/`} target="_blank" rel="noopener">
          <Icon name="external" />
          {a.toSite}
        </a>
        <details className="adm-user">
          <summary>
            <span className="adm-avatar" aria-hidden="true">
              {user.username.slice(0, 1).toUpperCase()}
            </span>
            <span className="adm-hide-m">{user.username}</span>
            <Icon name="chevron" />
          </summary>
          <div className="adm-menu">
            <p className="adm-menu-head">
              <b>{user.username}</b>
              <small>{isAdmin ? "Admin (100)" : `${user.acclevel}`}</small>
            </p>
            <Link href="/admin/account">
              <Icon name="lock" />
              {u.myAccount}
            </Link>
            <a href={`${basePath}/`} target="_blank" rel="noopener">
              <Icon name="external" />
              {a.toSite}
            </a>
            <div className="adm-menu-row">
              <span>{u.theme}</span>
              <form action={adminThemeAction} className="adm-seg">
                {ADMIN_THEMES.map((th) => (
                  <button
                    key={th}
                    type="submit"
                    name="theme"
                    value={th}
                    className={theme === th ? "on" : undefined}
                    title={themeLabel[th]}
                    aria-pressed={theme === th}
                  >
                    <Icon name={themeIcon[th]} />
                    <span className="sr">{themeLabel[th]}</span>
                  </button>
                ))}
              </form>
            </div>
            <div className="adm-menu-row">
              <span>{u.language}</span>
              <span className="adm-seg">
                {(["de", "en"] as const).map((l) => (
                  <a key={l} href={`${basePath}/lang/${l}`} className={lang === l ? "on" : undefined} hrefLang={l}>
                    {l.toUpperCase()}
                  </a>
                ))}
              </span>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="adm-menu-btn">
                <Icon name="logout" />
                {a.logout}
              </button>
            </form>
          </div>
        </details>
      </header>
      <div className="adm-shell">
        <aside className="adm-side" aria-label={u.menu}>
          <Suspense>
            <AdminSidebar
              t={text}
              isAdmin={isAdmin}
              footer={footer}
              rankings={rankings.map((r) => ({ code: r.code, name: r.name, servers: r.servers, hidden: r.hidden, tag: tagOf(r.base, r.code) }))}
              groups={settingGroups.map((g) => ({ id: g.id, area: g.area, title: g.title[lang] }))}
            />
          </Suspense>
        </aside>
        <label htmlFor="adm-nav" className="adm-scrim" aria-label={u.closeMenu} />
        <main className="adm-main">{children}</main>
      </div>
      <Suspense>
        <AreaTabs t={text} className="adm-bottom" />
      </Suspense>
    </>
  );
}

// Short tag of a ranking's game for the menu (CS:S, TF2, ...).
function tagOf(base: string | null, code: string) {
  return gameKind(base)?.short.replace(/\s+/g, "").slice(0, 5) ?? code.slice(0, 4).toUpperCase();
}

// GAMEWE_DOCKER is set in the image (Dockerfile); /.dockerenv covers other images.
function inDocker() {
  return process.env.GAMEWE_DOCKER === "1" || existsSync("/.dockerenv");
}

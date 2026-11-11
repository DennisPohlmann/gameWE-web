import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { adminThemeAction, logoutAction } from "../actions";
import { Icon } from "@/components/admin/icons";
import { IdleLogout } from "@/components/admin/idle-logout";
import { AdminSidebar, AreaTabs, Logo, type NavText } from "@/components/admin/nav";
import { entities } from "@/lib/admin-entities";
import { adminDict, tr } from "@/lib/admin-i18n";
import { rankingSummaries } from "@/lib/admin-rankings";
import { settingGroups } from "@/lib/admin-settings";
import { ADMIN_THEMES, getAdminTheme } from "@/lib/admin-theme";
import { LEVEL_ADMIN, requireAdmin } from "@/lib/auth";
import { collectorStatus } from "@/lib/collector-status";
import { fmtDateTime } from "@/lib/format";
import { basePath } from "@/lib/base-path";
import { gameKind } from "@/lib/games";
import { fill, getAdminLang, getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { releasePage } from "@/lib/update-version";
import { updateStatus } from "@/lib/updates";
import { webRuntime } from "@/lib/runtime";
import { runtimeSuffix } from "@/lib/runtime-label";
import { LangMenu } from "@/components/lang-menu";
import { FLAG_SPRITE_URL } from "@/lib/flag-codes";

// Frame of every admin page after the login: top bar with the three areas
// and the user menu, the side menu of the area (a drawer on phones, opened
// by the checkbox #adm-nav without script) and a bottom bar on phones.
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin();
  const [{ t: site }, lang, theme, rankings, status, settings, collector] = await Promise.all([
    getDict(),
    getAdminLang(),
    getAdminTheme(),
    rankingSummaries(),
    updateStatus(),
    getSettings(),
    collectorStatus(),
  ]);
  const a = adminDict(lang);
  const u = a.ui;
  const label = (key: string) => ((l) => (l ? tr(l, lang) : key))(entities.find((e) => e.key === key)?.label);
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
  // Versions, each a link to the page of its release, and a link to the
  // release of each available update (cached answers only; the overview
  // page asks GitHub, lib/updates.ts).
  const version = (text: string, href: string | null) => (href ? { text, href, version: true } : text);
  const web = process.env.APP_VERSION;
  // In brackets where it runs: (Docker), (Container), nothing on the host.
  // First the collector's state, a link to its page (/admin/collector).
  const footer: Parameters<typeof AdminSidebar>[0]["footer"] = [
    {
      text: { ok: u.csOk, stale: fill(u.csStale, { t: fmtDateTime(collector.heartbeat, lang) }), never: u.csNever }[collector.state],
      href: "/admin/collector",
      state: collector.state,
    },
    version(`gameWE Web ${web ? `v${web}` : "?"}${runtimeSuffix(webRuntime())}`, releasePage("web", web))];
  if (status.collector)
    footer.push(version(`gameWE Collector v${status.collector.slice(0, 32)}${runtimeSuffix(status.collectorRuntime)}`, releasePage("collector", status.collector)));
  for (const up of status.updates) footer.push({ text: `${up.component === "web" ? "Web" : "Collector"}: ${fill(u.footUpdate, { v: `v${up.latest}` })}`, href: up.url });
  if (status.failed) footer.push(u.footCheckFailed);
  const themeIcon = { auto: "auto", light: "sun", dark: "moon" } as const;
  const themeLabel = { auto: u.themeAuto, light: u.themeLight, dark: u.themeDark };

  return (
    <>
      <input type="checkbox" id="adm-nav" className="adm-nav-toggle" aria-hidden="true" tabIndex={-1} />
      <header className="adm-top">
        <label htmlFor="adm-nav" className="adm-icon-btn adm-burger" aria-label={u.menu}>
          <Icon name="menu" />
        </label>
        <Link prefetch={false} href="/admin" className="adm-brand">
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
        {/* Time left before the automatic sign-out (Settings → Admin area). */}
        <IdleLogout minutes={settings.adminIdleMinutes} base={basePath} label={u.idleIn} />
        {/* On phones only the icon, the text stays for screen readers. */}
        <a className="adm-tool adm-site" href={`${basePath}/`} target="_blank" rel="noopener" aria-label={a.toSite} title={a.toSite}>
          <Icon name="external" />
          <span className="adm-hide-m">{a.toSite}</span>
        </a>
        {/* The language of the admin area and the public pages. */}
        <style>{`.flag-svg{background-image:url(${basePath}${FLAG_SPRITE_URL})}`}</style>
        <LangMenu icon className="adm-lang" lang={lang} label={u.language} base={basePath} />
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
            <Link prefetch={false} href="/admin/account">
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
              rankings={rankings.map((r) => ({ code: r.code, name: r.name, servers: r.servers, hidden: r.hidden, tag: tagOf(r.base, r.code), template: r.template }))}
              groups={settingGroups.map((g) => ({ id: g.id, area: g.area, title: tr(g.title, lang) }))}
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


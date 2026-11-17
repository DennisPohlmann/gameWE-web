"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Icon, type IconName } from "./icons";
import { MenuDetails } from "./menu-details";
import type { Perm } from "@/lib/admin-perms";

// Menu of the admin area: the three areas (overview, rankings, settings)
// in the top bar and the bottom bar on phones, and the side menu of the
// area the page belongs to. Which area and which ranking a page belongs to
// comes from its address: /admin/rankings/<code>, ?game=<code> of the lists,
// or the list an edit page returns to (?returnTo=...game=<code>). Only what
// the admin's rights reach is shown (lib/admin-perms.ts; the pages check too).

export type NavCan = Record<Perm | "admin", boolean>;

export type NavRanking = { code: string; name: string; servers: number; hidden: boolean; tag: string; template: boolean };
export type NavGroup = { id: string; area: string; title: string };
export type NavText = Record<
  | "areaHome"
  | "areaRankings"
  | "areaSettings"
  | "menu"
  | "thisRanking"
  | "definitions"
  | "allRankings"
  | "manageRankings"
  | "newRanking"
  | "ranking"
  | "chooseRanking"
  | "noRanking"
  | "noRankingSub"
  | "overview"
  | "navHallOfFame"
  | "resetRanking"
  | "jobs"
  | "navWebsite"
  | "navServices"
  | "navCollector"
  | "navModeration"
  | "navAccess"
  | "rawOptions"
  | "privacy"
  | "areas"
  | "start"
  | "logout"
  | "servers"
  | "players"
  | "clans"
  | "weapons"
  | "actions"
  | "teams"
  | "roles"
  | "awards"
  | "ranks"
  | "users"
  | "adminRoles"
  | "chat"
  | "ips"
  | "colServers"
  | "account"
  | "accName"
  | "accPassword"
  | "accPasskeys"
  | "accSignIn"
  | "accTotp"
  | "accTokens"
  | "accNotify",
  string
>;

type Area = "home" | "rankings" | "settings" | "account";

// First path segment after /admin per area.
const RANKING_SEGMENTS = ["rankings", "games", "servers", "players", "clans", "weapons", "actions", "teams", "roles", "awards", "ranks", "reset"];
const RANKING_LISTS = ["servers", "players", "clans", "weapons", "actions", "teams", "roles", "awards", "ranks"];

function where(pathname: string, params: URLSearchParams) {
  const parts = pathname.split("/").filter(Boolean);
  const seg = parts[1] ?? "";
  const area: Area = seg === "" || seg === "jobs" || seg === "collector" ? "home" : seg === "account" ? "account" : RANKING_SEGMENTS.includes(seg) ? "rankings" : "settings";
  let game = params.get("game") ?? "";
  if (!game && seg === "rankings" && parts[2] && parts[2] !== "new") game = decodeURIComponent(parts[2]);
  if (!game) {
    const back = params.get("returnTo");
    if (back) {
      try {
        game = new URL(back, "http://x.invalid").searchParams.get("game") ?? "";
      } catch {}
    }
  }
  return { parts, seg, area, game, editing: parts.length > 2 && seg !== "rankings" && seg !== "settings" };
}

function useWhere() {
  const pathname = usePathname();
  const params = useSearchParams();
  return { pathname, ...where(pathname, new URLSearchParams(params.toString())) };
}

// The parts of My account, each its own page (app/admin/(panel)/account).
const ACCOUNT_PARTS: [string, IconName, keyof NavText][] = [
  ["profile", "gear", "accName"],
  ["password", "password", "accPassword"],
  ["passkeys", "key", "accPasskeys"],
  ["sign-in", "lock", "accSignIn"],
  ["totp", "shield", "accTotp"],
  ["api-tokens", "code", "accTokens"],
  ["notifications", "bell", "accNotify"],
];

const AREAS: [Area, string, IconName, keyof NavText][] = [
  ["home", "/admin", "home", "areaHome"],
  ["rankings", "/admin/rankings", "trophy", "areaRankings"],
  ["settings", "/admin/settings", "gear", "areaSettings"],
];

export function AreaTabs({ t, className, rankings = true }: { t: NavText; className: string; rankings?: boolean }) {
  const { area, game } = useWhere();
  return (
    <nav className={className} aria-label={t.menu}>
      {AREAS.filter(([key]) => rankings || key !== "rankings").map(([key, href, icon, label]) => (
        <Link prefetch={false}
          key={key}
          href={key === "rankings" && game ? `/admin/rankings/${encodeURIComponent(game)}` : href}
          className={area === key ? "on" : undefined}
          aria-current={area === key ? "page" : undefined}
        >
          <Icon name={icon} />
          <span>{t[label]}</span>
        </Link>
      ))}
      {className === "adm-bottom" ? (
        <label htmlFor="adm-nav" className="adm-bottom-menu">
          <Icon name="menu" />
          <span>{t.menu}</span>
        </label>
      ) : null}
    </nav>
  );
}

function Item({ href, icon, label, on, count }: { href: string; icon: IconName; label: string; on: boolean; count?: number }) {
  return (
    <Link prefetch={false} href={href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
      <Icon name={icon} />
      <span>{label}</span>
      {count !== undefined ? <span className="n">{count.toLocaleString()}</span> : null}
    </Link>
  );
}

export function AdminSidebar({
  t,
  rankings,
  groups,
  can,
  footer,
}: {
  t: NavText;
  rankings: NavRanking[];
  groups: NavGroup[];
  can: NavCan;
  // Lines below the menu; one with href is a link to an external page
  // (the release of a running version, or of an available update), one with
  // state the collector's state, a link to its page in the admin area.
  footer: (string | { text: string; href: string; version?: boolean; state?: "ok" | "stale" | "never" })[];
}) {
  const { pathname, parts, seg, area, game } = useWhere();
  // Close the phone menu after a click on one of its links: the sidebar
  // stays mounted across pages. The ranking picker closes itself (MenuDetails).
  useEffect(() => {
    const box = document.getElementById("adm-nav") as HTMLInputElement | null;
    if (box) box.checked = false;
  }, [pathname, game]);
  const current = rankings.find((r) => r.code === game);
  const q = current ? `?game=${encodeURIComponent(current.code)}` : "";
  const list = (key: string, icon: IconName, label: string, count?: number) => (
    <Item key={key} href={`/admin/${key}${q}`} icon={icon} label={label} on={seg === key} count={count} />
  );
  // Where the ranking picker leads: the same list or page for another ranking.
  const pickHref = (code: string) => {
    const c = encodeURIComponent(code);
    if (RANKING_LISTS.includes(seg) && parts.length === 2) return code ? `/admin/${seg}?game=${c}` : `/admin/${seg}`;
    if (seg === "reset") return code ? `/admin/reset?game=${c}` : "/admin/reset";
    return code ? `/admin/rankings/${c}` : "/admin/rankings";
  };
  const rankingsArea = can["rankings.view"] || can["servers.view"] || can["players.view"] || can["definitions.view"];
  const groupLinks = (areaKey: string, icons: Record<string, IconName>) =>
    groups
      .filter(() => can["settings.view"])
      .filter((g) => g.area === areaKey)
      .map((g) => (
        <Item key={g.id} href={`/admin/settings/${g.id}`} icon={icons[g.id] ?? "gear"} label={g.title} on={seg === "settings" && parts[2] === g.id} />
      ));

  return (
    <>
      <div className="adm-side-head">
        <span className="adm-brand">
          <Logo />
          <span>
            game<b>WE</b>
          </span>
        </span>
        <label htmlFor="adm-nav" className="adm-icon-btn" aria-label={t.menu}>
          <Icon name="close" />
        </label>
      </div>
      <nav className="adm-side-areas" aria-label={t.areas}>
        {AREAS.filter(([key]) => rankingsArea || key !== "rankings").map(([key, href, icon, label]) => (
          <Link prefetch={false} key={key} href={href} className={area === key ? "on" : undefined}>
            <Icon name={icon} />
            {t[label]}
          </Link>
        ))}
      </nav>
      {area === "home" ? (
        <>
          <h4>{t.start}</h4>
          <nav>
            <Item href="/admin" icon="home" label={t.areaHome} on={seg === ""} />
            {can["jobs.view"] ? <Item href="/admin/jobs" icon="clock" label={t.jobs} on={seg === "jobs"} /> : null}
            {can["jobs.view"] ? <Item href="/admin/collector" icon="pulse" label={t.navCollector} on={seg === "collector"} /> : null}
          </nav>
          <h4>{t.areas}</h4>
          <nav>
            {can["rankings.view"] ? <Item href="/admin/rankings" icon="trophy" label={t.areaRankings} on={false} /> : null}
            <Item href="/admin/settings" icon="gear" label={t.areaSettings} on={false} />
          </nav>
        </>
      ) : area === "account" ? (
        <>
          <h4>{t.account}</h4>
          <nav>
            <Item href="/admin/account" icon="home" label={t.overview} on={!parts[2]} />
            {ACCOUNT_PARTS.map(([key, icon, label]) => (
              <Item key={key} href={`/admin/account/${key}`} icon={icon} label={t[label]} on={parts[2] === key} />
            ))}
          </nav>
        </>
      ) : area === "rankings" ? (
        <>
          <MenuDetails className="adm-picker">
            <summary>
              <span className="adm-gtag"><bdi>{current ? current.tag : "∗"}</bdi></span>
              <span className="adm-picker-text">
                <small>{t.ranking}</small>
                <b><bdi>{current ? current.name : t.noRanking}</bdi></b>
                <small>{current ? `${current.code} · ${current.servers} ${t.colServers}` : t.noRankingSub}</small>
              </span>
              <Icon name="chevron" />
            </summary>
            <div className="adm-picker-list" role="list">
              <Link prefetch={false} href={pickHref("")} className={current ? undefined : "on"}>
                <span className="adm-gtag">∗</span>
                {t.noRanking}
              </Link>
              {/* No templates (seeded rankings without servers), except the
                  one whose definitions are open now. */}
              {rankings.filter((r) => !r.template || r.code === game).map((r) => (
                <Link prefetch={false} key={r.code} href={pickHref(r.code)} className={r.code === game ? "on" : undefined}>
                  <span className="adm-gtag"><bdi>{r.tag}</bdi></span>
                  <span>
                    <bdi>{r.name}</bdi>
                    <small>
                      {r.code} · {r.servers} {t.colServers}
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          </MenuDetails>
          <h4>{current ? t.thisRanking : t.allRankings}</h4>
          <nav>
            {current && can["rankings.view"] ? (
              <Item
                href={`/admin/rankings/${encodeURIComponent(current.code)}`}
                icon="pulse"
                label={t.overview}
                on={seg === "rankings" && parts[2] === current.code && !parts[3]}
              />
            ) : null}
            {/* Its hall of fame (entries and schedule), also before the first
                reset; not for a template (no servers), which is never reset. */}
            {current && can.resets && current.servers > 0 ? (
              <Item
                href={`/admin/rankings/${encodeURIComponent(current.code)}/hall-of-fame`}
                icon="trophy"
                label={t.navHallOfFame}
                on={seg === "rankings" && parts[2] === current.code && parts[3] === "hall-of-fame"}
              />
            ) : null}
            {can["servers.view"] ? list("servers", "server", t.servers, current?.servers) : null}
            {can["players.view"] ? list("players", "players", t.players) : null}
            {can["players.view"] ? list("clans", "shield", t.clans) : null}
            {can.resets ? <Item href={`/admin/reset${q}`} icon="reset" label={t.resetRanking} on={seg === "reset"} /> : null}
          </nav>
          {can["definitions.view"] ? (
            <>
              <h4>{t.definitions}</h4>
              <nav>
                {list("weapons", "weapon", t.weapons)}
                {list("actions", "bolt", t.actions)}
                {list("teams", "flag", t.teams)}
                {list("roles", "mask", t.roles)}
                {list("awards", "award", t.awards)}
                {list("ranks", "star", t.ranks)}
              </nav>
            </>
          ) : null}
          {can["rankings.view"] ? (
            <>
              <h4>{t.areaRankings}</h4>
              <nav>
                <Item
                  href="/admin/rankings"
                  icon="list"
                  label={t.manageRankings}
                  on={(seg === "rankings" && !parts[2]) || (seg === "games" && parts[2] !== "new")}
                  count={rankings.filter((r) => !r.template).length}
                />
                {can["rankings.edit"] ? <Item href="/admin/games/new" icon="plus" label={t.newRanking} on={seg === "games" && parts[2] === "new"} /> : null}
              </nav>
            </>
          ) : null}
        </>
      ) : (
        <>
          {can["settings.view"] ? (
            <>
              <h4>{t.navWebsite}</h4>
              <nav>
                {groupLinks("website", { general: "globe", design: "palette", header: "header", maps: "map", seo: "search" })}
                <Item href="/admin/privacy" icon="shield" label={t.privacy} on={seg === "privacy"} />
              </nav>
              <h4>{t.navServices}</h4>
              <nav>{groupLinks("services", { voice: "headset", bans: "ban", steam: "user", monitoring: "pulse", notifications: "bell" })}</nav>
            </>
          ) : null}
          {can["settings.view"] || can["jobs.view"] ? (
            <>
              <h4>{t.navCollector}</h4>
              <nav>
                {groupLinks("collector", { points: "points", capture: "shield", commands: "terminal" })}
                {can["jobs.view"] ? <Item href="/admin/jobs" icon="clock" label={t.jobs} on={false} /> : null}
              </nav>
            </>
          ) : null}
          {can["chat.view"] || can["ips.view"] ? (
            <>
              <h4>{t.navModeration}</h4>
              <nav>
                {can["chat.view"] ? <Item href="/admin/chat" icon="chat" label={t.chat} on={seg === "chat"} /> : null}
                {can["ips.view"] ? <Item href="/admin/ips" icon="ip" label={t.ips} on={seg === "ips"} /> : null}
              </nav>
            </>
          ) : null}
          {/* Admins, roles, the admin area's own settings and the raw values:
              one group instead of three. My account is only in the account
              menu at the top right. */}
          <h4>{t.navAccess}</h4>
          <nav>
            {can.admin ? <Item href="/admin/users" icon="user" label={t.users} on={seg === "users"} /> : null}
            {can.admin ? <Item href="/admin/admin-roles" icon="key" label={t.adminRoles} on={seg === "admin-roles"} /> : null}
            {can["settings.view"] ? groupLinks("admin", { admin: "gear" }) : null}
            {can["settings.view"] ? <Item href="/admin/settings/raw" icon="code" label={t.rawOptions} on={seg === "settings" && parts[2] === "raw"} /> : null}
          </nav>
        </>
      )}
      <div className="adm-side-foot">
        {footer.map((l) =>
          typeof l === "string" ? (
            <span key={l}>{l}</span>
          ) : l.state ? (
            <Link prefetch={false} key={l.href} className={`adm-collector ${l.state}`} href={l.href}>
              <i aria-hidden="true" />
              {l.text}
            </Link>
          ) : (
            <a key={l.href} className={l.version ? "adm-version" : "adm-update"} href={l.href} target="_blank" rel="noopener noreferrer">
              {l.text}
            </a>
          ),
        )}
      </div>
    </>
  );
}

export function Logo() {
  return (
    <svg viewBox="0 0 32 32" width="24" height="24" aria-hidden="true" className="adm-logo">
      <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M16 1v8M16 23v8M1 16h8M23 16h8" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.6" fill="var(--accent)" />
    </svg>
  );
}

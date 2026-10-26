"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { Icon, type IconName } from "./icons";

// Menu of the admin area: the three areas (overview, rankings, settings)
// in the top bar and the bottom bar on phones, and the side menu of the
// area the page belongs to. Which area and which ranking a page belongs to
// comes from its address: /admin/rankings/<code>, ?game=<code> of the lists,
// or the list an edit page returns to (?returnTo=...game=<code>).

export type NavRanking = { code: string; name: string; servers: number; hidden: boolean; tag: string };
export type NavGroup = { id: string; area: string; title: string };
export type NavText = Record<
  | "areaHome"
  | "areaRankings"
  | "areaSettings"
  | "menu"
  | "thisRanking"
  | "definitions"
  | "maintenance"
  | "allRankings"
  | "manageRankings"
  | "newRanking"
  | "ranking"
  | "chooseRanking"
  | "noRanking"
  | "noRankingSub"
  | "overview"
  | "resetRanking"
  | "navWebsite"
  | "navServices"
  | "navCollector"
  | "navModeration"
  | "navAccess"
  | "navAdvanced"
  | "navAccount"
  | "rawOptions"
  | "myAccount"
  | "areas"
  | "start"
  | "toSite"
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
  | "chat"
  | "ips"
  | "colServers",
  string
>;

type Area = "home" | "rankings" | "settings";

// First path segment after /admin per area.
const RANKING_SEGMENTS = ["rankings", "games", "servers", "players", "clans", "weapons", "actions", "teams", "roles", "awards", "ranks", "reset"];
const RANKING_LISTS = ["servers", "players", "clans", "weapons", "actions", "teams", "roles", "awards", "ranks"];

function where(pathname: string, params: URLSearchParams) {
  const parts = pathname.split("/").filter(Boolean);
  const seg = parts[1] ?? "";
  const area: Area = seg === "" ? "home" : RANKING_SEGMENTS.includes(seg) ? "rankings" : "settings";
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

const AREAS: [Area, string, IconName, keyof NavText][] = [
  ["home", "/admin", "home", "areaHome"],
  ["rankings", "/admin/rankings", "trophy", "areaRankings"],
  ["settings", "/admin/settings", "gear", "areaSettings"],
];

export function AreaTabs({ t, className }: { t: NavText; className: string }) {
  const { area, game } = useWhere();
  return (
    <nav className={className} aria-label={t.menu}>
      {AREAS.map(([key, href, icon, label]) => (
        <Link
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
    <Link href={href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>
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
  isAdmin,
  footer,
}: {
  t: NavText;
  rankings: NavRanking[];
  groups: NavGroup[];
  isAdmin: boolean;
  // Lines below the menu; one with href is a link to an external page
  // (the release of an available update).
  footer: (string | { text: string; href: string })[];
}) {
  const { pathname, parts, seg, area, game } = useWhere();
  // Close the phone menu after a click on one of its links.
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
  const groupLinks = (areaKey: string, icons: Record<string, IconName>) =>
    groups
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
        {AREAS.map(([key, href, icon, label]) => (
          <Link key={key} href={href} className={area === key ? "on" : undefined}>
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
          </nav>
          <h4>{t.areas}</h4>
          <nav>
            <Item href="/admin/rankings" icon="trophy" label={t.areaRankings} on={false} />
            <Item href="/admin/settings" icon="gear" label={t.areaSettings} on={false} />
          </nav>
          <h4>{t.navAccount}</h4>
          <nav>
            <Item href="/admin/account" icon="lock" label={t.myAccount} on={false} />
          </nav>
        </>
      ) : area === "rankings" ? (
        <>
          <details className="adm-picker">
            <summary>
              <span className="adm-gtag">{current ? current.tag : "∗"}</span>
              <span className="adm-picker-text">
                <small>{t.ranking}</small>
                <b>{current ? current.name : t.noRanking}</b>
                <small>{current ? `${current.code} · ${current.servers} ${t.colServers}` : t.noRankingSub}</small>
              </span>
              <Icon name="chevron" />
            </summary>
            <div className="adm-picker-list" role="list">
              <Link href={pickHref("")} className={current ? undefined : "on"}>
                <span className="adm-gtag">∗</span>
                {t.noRanking}
              </Link>
              {rankings.map((r) => (
                <Link key={r.code} href={pickHref(r.code)} className={r.code === game ? "on" : undefined}>
                  <span className="adm-gtag">{r.tag}</span>
                  <span>
                    {r.name}
                    <small>
                      {r.code} · {r.servers} {t.colServers}
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          </details>
          <h4>{current ? t.thisRanking : t.allRankings}</h4>
          <nav>
            {current ? (
              <Item
                href={`/admin/rankings/${encodeURIComponent(current.code)}`}
                icon="pulse"
                label={t.overview}
                on={seg === "rankings" && parts[2] === current.code}
              />
            ) : null}
            {isAdmin ? list("servers", "server", t.servers, current?.servers) : null}
            {list("players", "players", t.players)}
            {list("clans", "shield", t.clans)}
          </nav>
          <h4>{t.definitions}</h4>
          <nav>
            {list("weapons", "weapon", t.weapons)}
            {list("actions", "bolt", t.actions)}
            {list("teams", "flag", t.teams)}
            {list("roles", "mask", t.roles)}
            {list("awards", "award", t.awards)}
            {list("ranks", "star", t.ranks)}
          </nav>
          {isAdmin ? (
            <>
              <h4>{t.maintenance}</h4>
              <nav>
                <Item href={`/admin/reset${q}`} icon="reset" label={t.resetRanking} on={seg === "reset"} />
              </nav>
              <h4>{t.allRankings}</h4>
              <nav>
                <Item
                  href="/admin/rankings"
                  icon="list"
                  label={t.manageRankings}
                  on={(seg === "rankings" && !parts[2]) || (seg === "games" && parts[2] !== "new")}
                  count={rankings.length}
                />
                <Item href="/admin/games/new" icon="plus" label={t.newRanking} on={seg === "games" && parts[2] === "new"} />
              </nav>
            </>
          ) : null}
        </>
      ) : (
        <>
          <h4>{t.navWebsite}</h4>
          <nav>{groupLinks("website", { general: "globe", design: "palette", header: "header", maps: "map", seo: "search" })}</nav>
          <h4>{t.navServices}</h4>
          <nav>{groupLinks("services", { voice: "headset", bans: "ban", monitoring: "pulse" })}</nav>
          <h4>{t.navCollector}</h4>
          <nav>{groupLinks("collector", { points: "points", capture: "shield", commands: "terminal" })}</nav>
          <h4>{t.navModeration}</h4>
          <nav>
            <Item href="/admin/chat" icon="chat" label={t.chat} on={seg === "chat"} />
            <Item href="/admin/ips" icon="ip" label={t.ips} on={seg === "ips"} />
          </nav>
          <h4>{t.navAccess}</h4>
          <nav>
            {isAdmin ? <Item href="/admin/users" icon="user" label={t.users} on={seg === "users"} /> : null}
            <Item href="/admin/account" icon="lock" label={t.myAccount} on={seg === "account" || seg === "totp"} />
          </nav>
          <h4>{t.navAdvanced}</h4>
          <nav>
            <Item href="/admin/settings/raw" icon="code" label={t.rawOptions} on={seg === "settings" && parts[2] === "raw"} />
            {groupLinks("advanced", { older: "clock" })}
          </nav>
        </>
      )}
      <div className="adm-side-foot">
        {footer.map((l) =>
          typeof l === "string" ? (
            <span key={l}>{l}</span>
          ) : (
            <a key={l.href} className="adm-update" href={l.href} target="_blank" rel="noopener noreferrer">
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

import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import type { ReactNode } from "react";
import { getSettings, titleTemplate } from "@/lib/settings";
import { headerTabs } from "@/lib/header-links";
import { getDict } from "@/lib/i18n";
import { localeOf } from "@/lib/format";
import { statsOrigin } from "@/lib/site-url";
import { LANGUAGES } from "@/translations/languages";
import { LangFlag } from "@/components/lang-flag";
import { ShareMenu } from "@/components/share-menu";
import { basePath } from "@/lib/base-path";
import { FLAG_SPRITE_URL } from "@/lib/flag-codes";
import { Crumbs } from "@/components/crumbs";
import { ConsentRoot, PRIVACY_HREF } from "@/components/consent";
import { getConsent } from "@/lib/consent-server";
import { getGames } from "@/lib/data";
import { resolveTemplate, themeStyle } from "@/lib/templates";
import "./globals.css";

// Every page reads live data from the collector's database.
export const dynamic = "force-dynamic";

// Titles, description and link previews (Admin → Settings → SEO).
export async function generateMetadata(): Promise<Metadata> {
  const [s, { lang, t }, origin] = await Promise.all([getSettings(), getDict(), statsOrigin()]);
  const description = s.seoDescription || t.seoDescription;
  const image = s.seoImage || s.logoUrl;
  const images = image ? [image] : undefined;
  let base: URL | undefined;
  try {
    base = new URL(`${origin}/`);
  } catch {}
  return {
    metadataBase: base,
    title: titleTemplate(s.titleFormat, { site: s.siteName }),
    icons: {
      icon: s.favicon
        ? [{ url: s.favicon }]
        : [
            { url: `${basePath}/icon.svg`, type: "image/svg+xml" },
            { url: `${basePath}/icon-32.png`, type: "image/png", sizes: "32x32" },
          ],
      // iOS share sheet and home screen.
      apple: [{ url: s.appleIcon || `${basePath}/apple-touch-icon.png`, sizes: "180x180" }],
    },
    applicationName: s.siteName,
    description,
    keywords: s.seoKeywords.split(",").map((k) => k.trim()).filter(Boolean),
    robots: s.seoIndex ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: "website", siteName: s.siteName, description, images, locale: localeOf(lang).replace("-", "_") },
    twitter: { card: image ? "summary_large_image" : "summary", site: s.seoTwitter || undefined, description, images },
  };
}


// Windows and macOS get their own font stack and sizes (globals.css,
// html[data-os]); Linux keeps the default rendering.
async function clientOs(): Promise<"win" | "mac" | undefined> {
  const h = await headers();
  const platform = (h.get("sec-ch-ua-platform") ?? "").replace(/"/g, "");
  const ua = h.get("user-agent") ?? "";
  if (platform === "Windows" || /Windows NT/.test(ua)) return "win";
  if (platform === "macOS" || /Macintosh|Mac OS X/.test(ua)) return /iPhone|iPad/.test(ua) ? undefined : "mac";
  return undefined;
}

// Page frame in the style of gameME: header with tabs, breadcrumb bar with
// the languages, optional logo, content, footer.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { lang, t } = await getDict();
  const { siteName, siteUrl, logoUrl, headerLogo, links, headerHome, headerOrder, geoipCredit, skin, sourcebansUrl } = await getSettings();
  const [games, template, os, consent] = await Promise.all([getGames().catch(() => []), resolveTemplate(skin), clientOs(), getConsent()]);
  const theme = template ? await themeStyle(template) : null;
  const sections = {
    "": t.servers,
    servers: t.servers,
    players: t.players,
    clans: t.clans,
    awards: t.awards,
    weapons: t.weapons,
    actions: t.actions,
    maps: t.maps,
    teams: t.teams,
    chat: t.chat,
  };
  return (
    <html lang={lang} data-skin={template?.id ?? "default"} data-os={os}>
      <head>
        {/* The template's variables: in the page when small, else linked. */}
        {theme && "css" in theme ? <style>{theme.css}</style> : theme ? <link rel="stylesheet" href={theme.href} /> : null}
        {/* All flags come out of one picture (public/flags/sprite.png). */}
        <style>{`.flag-svg{background-image:url(${basePath}${FLAG_SPRITE_URL})}`}</style>
      </head>
      <body>
        {/* First in the page, so keyboard and screen reader users reach it
            first; shown fixed at the bottom, so nothing moves. */}
        <ConsentRoot consent={consent} t={t.consent} />
        <header className="header">
          <Link prefetch={false} href="/" className={headerLogo ? "logo logo-img" : "logo"} title={siteName}>
            {headerLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={headerLogo} alt={siteName} />
            ) : (
              <>
                <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
                  <circle cx="16" cy="16" r="10.5" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path d="M16 1v8M16 23v8M1 16h8M23 16h8" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="16" cy="16" r="2.6" fill="var(--accent)" />
                </svg>
                <span className="logo-word">
                  game<b>WE</b>
                </span>
              </>
            )}
          </Link>
          <nav className="tabs-top" aria-label={siteName}>
            {headerTabs(
              { order: headerOrder, home: headerHome, links, sourcebansUrl },
              { home: t.contents, search: t.searchTitle, help: t.help, licenses: t.licenses, privacy: t.privacy.title },
            ).map((tab) =>
              tab.kind === "page" ? (
                <Link prefetch={false} key={tab.id} href={tab.href}>
                  {tab.label}
                </Link>
              ) : (
                <a key={tab.id} href={tab.href} {...(tab.kind === "external" ? { target: "_blank", rel: "noopener" } : {})}>
                  {tab.label}
                </a>
              ),
            )}
          </nav>
        </header>
        <div className="nav-bar">
          <Crumbs
            site={{ name: siteName, url: siteUrl }}
            statistics={t.statistics}
            games={Object.fromEntries(games.map((g) => [g.code, g.name]))}
            sections={sections}
            pages={{ search: t.searchTitle, help: t.help, licenses: t.licenses, privacy: t.privacy.title, api: t.api }}
          />
          <ShareMenu labels={{ share: t.share, copy: t.shareCopy, copied: t.copied, email: t.shareEmail }} />
          <span className="langs" aria-label={t.language}>
            {LANGUAGES.map((l) => (
              <a key={l.code} href={`${basePath}/lang/${l.code}`} hrefLang={l.locale} title={l.name} aria-current={l.code === lang ? "true" : undefined}>
                <LangFlag code={l.flag} title={l.name} />
              </a>
            ))}
          </span>
        </div>
        {logoUrl ? (
          <div className="cust-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt={siteName} />
          </div>
        ) : null}
        <main className="page">
          {children}
        </main>
        <footer className="footer">
          {/* The full credits are on /licenses; the GeoIP licenses ask for a
              link on every page that shows their data, so it stays here, short. */}
          <p className="small">
            {t.poweredBy} · <Link prefetch={false} href="/privacy">{t.privacy.title}</Link> ·{" "}
            <a href={PRIVACY_HREF} data-consent-open="">
              {t.consent.footerLink}
            </a>{" "}
            · <Link prefetch={false} href="/licenses">{t.licenses}</Link> · <Link prefetch={false} href="/api">{t.api}</Link>
            {geoipCredit === "dbip" ? (
              <>
                {" · "}
                <a href="https://db-ip.com" rel="noopener noreferrer" target="_blank">
                  IP Geolocation by DB-IP
                </a>
              </>
            ) : geoipCredit === "maxmind" ? (
              <>
                {" · "}
                <a href="https://www.maxmind.com" rel="noopener noreferrer" target="_blank">
                  GeoLite2 data by MaxMind
                </a>
              </>
            ) : null}
            {" · "}
            <Link prefetch={false} href="/admin" target="_blank" rel="noopener">
              Admin
            </Link>
          </p>
        </footer>
      </body>
    </html>
  );
}

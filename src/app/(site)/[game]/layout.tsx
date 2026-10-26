import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { GameNav } from "@/components/nav";
import { VoiceBox } from "@/components/voice-box";
import { currentAdmin } from "@/lib/auth";
import { getGame } from "@/lib/data";
import { hallOfFameShown } from "@/lib/hall-of-fame";
import { getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { rankingTitle } from "@/lib/ranking-title";
import { gameTemplate, themeStyle } from "@/lib/templates";

// Pages of a ranking carry its name in the browser title (Settings →
// Browser title in rankings), e.g. "GunGame Players | Clan". Absolute, so the
// site's own title format is not added a second time (e.g. on a 404).
export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const title = await rankingTitle((await params).game);
  return title ? { title: { absolute: title.default, template: title.template } } : {};
}

export default async function GameLayout({ children, params }: { children: ReactNode; params: Promise<{ game: string }> }) {
  const { game: code } = await params;
  // A hidden ranking is shown to admins only.
  const game = (await getGame(code)) ?? ((await currentAdmin()) ? await getGame(code, true) : undefined);
  if (!game) notFound();
  const { t } = await getDict();
  const { chatPublic, gameEvents, gameSkins } = await getSettings();
  const skin = gameSkins ? await gameTemplate(game.realgame, game.code) : null;
  const theme = skin ? await themeStyle(skin, true) : null;
  // In groups: the start page and who plays, honours, the game's statistics,
  // what happens on the servers (events, chat), the rest.
  const items = [
    { href: "", label: t.servers, icon: "🖥" },
    { href: "/players", label: t.players, icon: "👤" },
    { href: "/clans", label: t.clans, icon: "👥" },
    ...((await hallOfFameShown(game.code)) ? [{ href: "/hall-of-fame", label: t.hallOfFame, icon: "⭐" }] : []),
    { href: "/awards", label: t.awards, icon: "🏆" },
    { href: "/weapons", label: t.weapons, icon: "🔫" },
    { href: "/actions", label: t.actions, icon: "🎯" },
    { href: "/maps", label: t.maps, icon: "🗺" },
    { href: "/teams", label: t.teams, icon: "🚩" },
    ...(gameEvents !== "off" ? [{ href: "/events", label: t.events, icon: "⚡" }] : []),
    ...(chatPublic ? [{ href: "/chat", label: t.chat, icon: "💬" }] : []),
    { href: "/misc", label: t.misc, icon: "📊" },
    { href: "/bans", label: t.bans, icon: "🚫" },
  ];
  return (
    <>
      {skin ? (
        <>
          {/* React lifts both into the head (precedence); the style's href is only its key. */}
          {theme && "css" in theme ? (
            <style href={`theme-${skin.id}-${skin.mtime}`} precedence="game">
              {theme.css}
            </style>
          ) : theme ? (
            <link rel="stylesheet" href={theme.href} precedence="game" />
          ) : null}
          <i className={`skin-${skin.id}`} hidden />
        </>
      ) : null}
      {/* Asks the TeamSpeak server (up to 4 s when it is down): not before the page. */}
      <Suspense fallback={null}>
        <VoiceBox />
      </Suspense>
      <div className="block">
        <h3>{t.sections}</h3>
        <div className="container sections-box">
          <GameNav game={game.code} items={items} />
        </div>
      </div>
      {children}
    </>
  );
}

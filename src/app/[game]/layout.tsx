import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { GameNav } from "@/components/nav";
import { VoiceBox } from "@/components/voice-box";
import { currentAdmin } from "@/lib/auth";
import { getGame } from "@/lib/data";
import { getDict } from "@/lib/i18n";
import { basePath } from "@/lib/base-path";
import { getSettings, titleTemplate } from "@/lib/settings";
import { gameTemplate } from "@/lib/templates";

// Pages of a ranking carry its name in the browser title (Settings →
// Browser title in rankings), e.g. "GunGame Players | Clan".
export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const { game: code } = await params;
  const game = (await getGame(code)) ?? ((await currentAdmin()) ? await getGame(code, true) : undefined);
  if (!game) return {};
  const s = await getSettings();
  return { title: titleTemplate(s.titleFormatRanking, { site: s.siteName, ranking: game.name }) };
}

export default async function GameLayout({ children, params }: { children: ReactNode; params: Promise<{ game: string }> }) {
  const { game: code } = await params;
  // A hidden ranking is shown to admins only.
  const game = (await getGame(code)) ?? ((await currentAdmin()) ? await getGame(code, true) : undefined);
  if (!game) notFound();
  const { t } = await getDict();
  const { chatPublic, gameSkins } = await getSettings();
  const skin = gameSkins ? await gameTemplate(game.realgame, game.code) : null;
  const items = [
    { href: "", label: t.servers, icon: "🖥" },
    { href: "/players", label: t.players, icon: "👤" },
    { href: "/clans", label: t.clans, icon: "👥" },
    { href: "/awards", label: t.awards, icon: "🏆" },
    { href: "/weapons", label: t.weapons, icon: "🔫" },
    { href: "/actions", label: t.actions, icon: "🎯" },
    { href: "/maps", label: t.maps, icon: "🗺" },
    { href: "/teams", label: t.teams, icon: "🚩" },
    ...(chatPublic ? [{ href: "/chat", label: t.chat, icon: "💬" }] : []),
    { href: "/misc", label: t.misc, icon: "📊" },
    { href: "/bans", label: t.bans, icon: "🚫" },
  ];
  return (
    <>
      {skin ? (
        <>
          <link rel="stylesheet" href={`${basePath}/theme/${skin.id}.game.css?v=${skin.mtime}`} precedence="game" />
          <i className={`skin-${skin.id}`} hidden />
        </>
      ) : null}
      <VoiceBox />
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

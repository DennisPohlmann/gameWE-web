import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getPlayer, noProfile } from "@/lib/data";
import { getPlayerAwardWins, getPlayerChatCount } from "@/lib/history";
import type { Dict } from "@/lib/i18n";
import { currentAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export type HistoryTab = "events" | "awards" | "sessions" | "chat" | "ips";

// Chat is public when the setting says so, IPs never; a signed-in admin sees both.
export async function historyAccess() {
  const [{ chatPublic }, admin] = await Promise.all([getSettings(), currentAdmin()]);
  return { chat: chatPublic || !!admin, ips: !!admin };
}

// Loads the player of a history page; wrong ranking -> the right URL.
export async function loadHistoryPlayer(game: string, raw: string, tab: HistoryTab) {
  const id = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const p = await getPlayer(id);
  if (!p || (await noProfile(p))) notFound();
  if (tab === "chat" || tab === "ips") {
    const access = await historyAccess();
    if (!access[tab]) notFound();
  }
  if (p.game !== game) redirect(`/${p.game}/players/${id}/${tab}`);
  return p;
}

// gameME's link bar of a player: Events, Awards (n), Sessions, Chat (the
// search is in the header).
export async function PlayerLinks({ game, id, t, active }: { game: string; id: number; name: string | null; t: Dict; active?: HistoryTab }) {
  const { chat: showChat, ips } = await historyAccess();
  const [awards, chat] = await Promise.all([getPlayerAwardWins(id, 0, 0), showChat ? getPlayerChatCount(id) : Promise.resolve(0)]);
  const base = `/${game}/players/${id}`;
  const tabs: [HistoryTab, string][] = [
    ["events", t.histEvents],
    ["awards", `${t.histAwards} (${awards.total})`],
    ["sessions", t.histSessions],
    ...(showChat ? [["chat", `${t.histChat} (${chat})`] as [HistoryTab, string]] : []),
    ...(ips ? [["ips", t.histIps] as [HistoryTab, string]] : []),
  ];
  return (
    <nav className="player-links">
      {tabs.map(([k, label]) => (
        <Link key={k} href={`${base}/${k}`} className={active === k ? "active" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export async function HistoryFrame({
  game,
  id,
  name,
  t,
  tab,
  back = true,
  children,
}: {
  game: string;
  id: number;
  name: string | null;
  t: Dict;
  tab: HistoryTab;
  // false: the page puts its own BackToPlayer lines (the sessions page).
  back?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <header className="section-head">
        <h2>
          {t.playerHistory}: {name ?? `#${id}`}
        </h2>
      </header>
      {back ? (
        <p className="history-back">
          <Link href={`/${game}/players/${id}`}>← {t.backToPlayer}</Link>
        </p>
      ) : null}
      <PlayerLinks game={game} id={id} name={name} t={t} active={tab} />
      {children}
    </section>
  );
}

// gameME's "Back to Player Information", right-aligned above a box.
export function BackToPlayer({ game, id, t }: { game: string; id: number; t: Pick<Dict, "backTo" | "playerInfo"> }) {
  return (
    <p className="back-to">
      {t.backTo} <Link href={`/${game}/players/${id}`}>{t.playerInfo}</Link>
    </p>
  );
}

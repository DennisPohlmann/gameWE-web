import { BanBadge, BanMark } from "./ui";
import { banSlots, markKind, type BanEntry, type BanKind } from "@/lib/ban-merge";
import { fmtDateTime } from "@/lib/format";
import { fill, type Dict, type Lang } from "@/lib/i18n";

// Ban badges and the "!" behind the name, shared by the bans page and the
// player profile.

export function banKindLabel(kind: BanKind, t: Dict): string {
  return { vac: "VAC", sourcebans: "SourceBans", sourcemod: "SourceMod", amx: "AMX", engine: t.banTypeServer }[kind];
}

// The tooltip of a badge: source, reason, date and length or end.
export function banTip(b: BanEntry, t: Dict, lang: Lang): string {
  const date = b.at ? fmtDateTime(b.at, lang) : b.dateText;
  const end = b.until ? fill(t.banUntil, { x: fmtDateTime(b.until, lang) }) : b.length;
  return [banKindLabel(b.kind, t), b.reason, date ? `${t.banDate} ${date}` : "", end].filter(Boolean).join(" · ");
}

// The player's bans on the SourceBans site (its ban list searched by the
// player's Steam ID), for the SourceBans badge.
export function sourcebansSearchUrl(base: string, steam2: string | null | undefined): string | undefined {
  return base && steam2 ? `${base}index.php?p=banlist&advSearch=${encodeURIComponent(steam2)}&advType=steamid` : undefined;
}

// VAC and SourceBans side by side (the sources in `always`; grey when that
// ban does not apply), server bans only when one runs. The details of each
// ban show on hover; a badge with a link in `links` opens the source's page
// of the player's bans.
export function BanBadges({ bans, always, links, t, lang }: { bans: BanEntry[]; always: BanKind[]; links?: Partial<Record<BanKind, string>>; t: Dict; lang: Lang }) {
  return (
    <span className="ban-badges">
      {banSlots(bans, always).map(({ kind, ban }) =>
        ban ? (
          <BanBadge key={kind} kind={kind} label={banKindLabel(kind, t)} text={banTip(ban, t, lang)} href={links?.[kind]} />
        ) : (
          <BanBadge key={kind} kind={kind} label={banKindLabel(kind, t)} text={fill(t.banNone, { x: banKindLabel(kind, t) })} off />
        ),
      )}
    </span>
  );
}

// The "!" behind a banned player's name; its tooltip lists every running
// ban with its details, one per line. Nothing without a ban.
export function NameBanMark({ bans, t, lang }: { bans: BanEntry[]; t: Dict; lang: Lang }) {
  if (!bans.length) return null;
  return <BanMark kind={markKind(bans)} text={[t.banned, ...bans.map((b) => banTip(b, t, lang))].join("\n")} />;
}

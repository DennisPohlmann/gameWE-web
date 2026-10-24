import type { Metadata } from "next";
import Form from "next/form";
import type { ReactNode } from "react";
import { HistoryFrame, loadHistoryPlayer } from "@/components/player-history";
import { Empty, Pager, PlayerLink, ROW_OPTIONS, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { Weapon } from "@/components/weapon";
import { fmtDateTime, localeOf } from "@/lib/format";
import { getGame, getPlayerFlags } from "@/lib/data";
import { EVENT_KINDS, countPlayerEvents, getPlayerEvents, type EventKind } from "@/lib/history";
import { fill, getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { weaponImages } from "@/lib/weapons";

// Events whose {x} is the weapon.
const WEAPON_KINDS: ReadonlySet<EventKind> = new Set(["kill", "death", "suicide", "teamkill"]);

type Props = { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.playerHistory}: ${t.histEvents}` };
}

export default async function EventsPage({ params, searchParams }: Props) {
  const { game, id } = await params;
  const sp = await searchParams;
  const p = await loadHistoryPlayer(game, id, "events");
  const { lang, t } = await getDict();
  const { pageSize } = await getSettings();
  const limit = rowsParam(sp.rows, pageSize);
  const page = pageParam(sp.page);
  const type = strParam(sp.type) as EventKind;
  const kinds = EVENT_KINDS.includes(type) ? [type] : [...EVENT_KINDS];
  const [rows, total] = await Promise.all([getPlayerEvents(p.playerId, kinds, limit, (page - 1) * limit), countPlayerEvents(p.playerId, kinds)]);
  const [flags, g] = await Promise.all([getPlayerFlags(rows.map((r) => r.other)), getGame(game, true)]);
  const images = weaponImages(g?.realgame);
  const base = `/${game}/players/${p.playerId}/events`;

  // The sentence of an event, with the other player as a link and the
  // weapon of kills and deaths as its image.
  const text = (e: (typeof rows)[number]): ReactNode => {
    const armed = WEAPON_KINDS.has(e.kind) && !!(e.text || e.code);
    const tpl = fill(t.evText[e.kind], { x: armed ? "\u0001" : e.text || e.code || "?", n: e.num, old: e.text, new: e.code, p: "\u0000" });
    const head = e.kind === "kill" || e.kind === "death" ? (e.num ? <span className="hs" title="Headshot">HS</span> : null) : null;
    return (
      <>
        {tpl.split(/(\u0000|\u0001)/).map((part, i) =>
          part === "\u0000" ? (
            <PlayerLink key={i} game={game} id={e.other} name={e.otherName} flag={flags.get(e.other)} />
          ) : part === "\u0001" ? (
            <Weapon key={i} set={images} code={e.code} name={e.text} height={20} />
          ) : (
            part
          ),
        )}
        {head ? <> {head}</> : null}
      </>
    );
  };

  return (
    <HistoryFrame game={game} id={p.playerId} name={p.name} t={t} tab="events">
      <Form className="search" action={base}>
        <select name="type" defaultValue={kinds.length === 1 ? type : ""} aria-label={t.eventType}>
          <option value="">{t.allTypes}</option>
          {EVENT_KINDS.filter((k) => k !== "playeraction").map((k) => (
            <option key={k} value={k}>
              {t.evKind[k]}
            </option>
          ))}
        </select>
        <button type="submit">{t.filter}</button>
      </Form>
      {rows.length ? (
        <>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>{t.time}</th>
                  <th>{t.eventType}</th>
                  <th>{t.eventText}</th>
                  <th className="hide-sm">{t.map}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((e, i) => (
                  <tr key={i} className={`ev-${e.kind}`}>
                    <td className="muted nowrap">{fmtDateTime(e.ts, lang)}</td>
                    <td>{t.evKind[e.kind]}</td>
                    <td className="wrap-cell">{text(e)}</td>
                    <td className="hide-sm muted">{e.map ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pager base={base} params={{ type: kinds.length === 1 ? type : undefined, rows: limit !== pageSize ? limit : undefined }} page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
        </>
      ) : (
        <Empty>{t.noData}</Empty>
      )}
    </HistoryFrame>
  );
}

import Form from "next/form";
import Link from "next/link";
import { Empty, Pager, ROW_OPTIONS, Section, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { localeOf } from "@/lib/format";
import { optionList } from "@/lib/admin-data";
import { adminDict } from "@/lib/admin-i18n";
import { requireAdmin } from "@/lib/auth";
import { countChat, getChat } from "@/lib/data";
import { fmtDateTime } from "@/lib/format";
import { getDict } from "@/lib/i18n";

// All stored chat, for admins (the public pages show it only when
// gamewe_chat_public is on).
export default async function AdminChat({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const { lang, t } = await getDict();
  const a = adminDict(lang);
  const sp = await searchParams;
  const game = strParam(sp.game);
  const q = strParam(sp.q);
  const player = Number.parseInt(strParam(sp.player), 10) || 0;
  const page = pageParam(sp.page);
  const limit = rowsParam(sp.rows, 100);
  const filter = { game: game || undefined, playerId: player || undefined, search: q || undefined };
  const [rows, total, games] = await Promise.all([
    getChat({ ...filter, limit, offset: (page - 1) * limit }),
    countChat(filter),
    optionList("games", true),
  ]);
  const base = "/admin/chat";
  return (
    <>
      <h1>{t.chat}</h1>
      <Section
        title={t.chat}
        aside={
          <Form className="search" action={base}>
            <select {...noAutofill} name="game" defaultValue={game} aria-label={a.allGames}>
              <option value="">{a.allGames}</option>
              {games.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            {player ? <input type="hidden" name="player" value={player} /> : null}
            <input {...noAutofill} type="search" name="q" defaultValue={q} placeholder={t.search} aria-label={t.search} />
            <button type="submit">{a.filter}</button>
          </Form>
        }
      >
        {player ? (
          <p>
            {t.player} #{player} · <Link href={base}>{a.allChat}</Link>
          </p>
        ) : null}
        {rows.length ? (
          <>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>{t.date}</th>
                    <th>{t.player}</th>
                    <th>{t.message}</th>
                    <th className="hide-sm">{t.server}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, limit).map((c, i) => (
                    <tr key={i}>
                      <td className="muted nowrap">{fmtDateTime(c.timestamp_id, lang)}</td>
                      <td>
                        <Link href={`${base}?player=${c.playerId}`}>{c.name ?? `#${c.playerId}`}</Link>
                      </td>
                      <td className="wrap-cell">
                        {c.message_mode === 2 ? <span className="muted">({t.sayTeam}) </span> : null}
                        {c.message}
                      </td>
                      <td className="hide-sm muted">{c.server ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
            <Pager
              base={base}
              params={{ game: game || undefined, q: q || undefined, player: player || undefined, rows: limit !== 100 ? limit : undefined }}
              page={page}
              pages={Math.max(1, Math.ceil(total / limit))}
              total={total}
              rows={{ value: limit, options: ROW_OPTIONS }}
              locale={localeOf(lang)}
              labels={a.pager}
            />
          </>
        ) : (
          <Empty>{q ? t.noResults : t.noData}</Empty>
        )}
      </Section>
    </>
  );
}

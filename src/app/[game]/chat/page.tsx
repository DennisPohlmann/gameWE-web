import type { Metadata } from "next";
import Form from "next/form";
import { notFound } from "next/navigation";
import { Empty, Pager, PlayerLink, ROW_OPTIONS, Section, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { getSettings } from "@/lib/settings";
import { countChat, getChat, getPlayerFlags } from "@/lib/data";
import { fmtDateTime, localeOf } from "@/lib/format";
import { getDict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.chat };
}

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { game } = await params;
  const sp = await searchParams;
  const q = strParam(sp.q);
  const page = pageParam(sp.page);
  const { lang, t } = await getDict();
  const { pageSize, chatPublic } = await getSettings();
  const limit = rowsParam(sp.rows, pageSize);
  if (!chatPublic) notFound();
  const [rows, total] = await Promise.all([getChat({ game, search: q, limit, offset: (page - 1) * limit }), countChat({ game, search: q })]);
  const flags = await getPlayerFlags(rows.map((r) => r.playerId));
  const base = `/${game}/chat`;
  return (
    <Section
      title={t.chat}
      aside={
        <Form className="search" action={base} role="search">
          <input {...noAutofill} type="search" name="q" defaultValue={q} placeholder={t.search} aria-label={t.search} />
          <button type="submit">{t.search}</button>
        </Form>
      }
    >
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
                      <PlayerLink game={game} id={c.playerId} name={c.name} flag={flags.get(c.playerId)} />
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
          <Pager base={base} params={{ q: q || undefined, rows: limit !== pageSize ? limit : undefined }} page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
        </>
      ) : (
        <Empty>{q ? t.noResults : t.noData}</Empty>
      )}
    </Section>
  );
}

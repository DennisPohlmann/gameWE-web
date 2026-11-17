import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteWebhookAction, saveWebhookAction } from "../../../../../actions";
import { AutoRefresh } from "@/components/auto-refresh";
import { ConfirmButton } from "@/components/admin/confirm-button";
import { Icon } from "@/components/admin/icons";
import { WebhookStatusLine } from "@/components/admin/notify-status";
import { PageHead } from "@/components/admin/page-head";
import { WebhookHeaders } from "@/components/admin/webhook-headers";
import { Section } from "@/components/ui";
import { adminDict, localized, tr } from "@/lib/admin-i18n";
import { collectorRunning, jobsAvailable } from "@/lib/reset";
import { NOTIFY_EVENT_LABELS } from "@/lib/admin-settings";
import { NOTIFY_T, WEBHOOK_T } from "@/lib/admin-texts";
import { getWebhook, webhooksAvailable } from "@/lib/admin-webhooks";
import { requirePerm } from "@/lib/auth";
import { noAutofill } from "@/lib/autofill";
import { fill, getAdminLang } from "@/lib/i18n";
import { EVENTS, MAX_WEBHOOK_HEADERS, MAX_WEBHOOK_TEXT, MAX_WEBHOOK_URL, WEBHOOK_EVENT_VARS, WEBHOOK_METHODS, WEBHOOK_VARS } from "@/lib/notify-core";

// One webhook of Settings → Notifications (id "new": a new one): its event,
// address, method, headers, expected status and payload, its last call and
// a test, and deleting it. Only with settings.protected.
export default async function WebhookPage({ params, searchParams }: { params: Promise<{ group: string; id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePerm("settings.protected");
  const { group, id } = await params;
  if (group !== "notifications") notFound();
  const isNew = id === "new";
  const [hook, table, run, jobs] = await Promise.all([isNew ? null : getWebhook(id), webhooksAvailable(), collectorRunning(), jobsAvailable()]);
  if (!table || (!isNew && !hook)) notFound();
  const lang = await getAdminLang();
  const a = adminDict(lang);
  const w = localized(WEBHOOK_T, lang);
  const n = localized(NOTIFY_T, lang);
  const sp = await searchParams;
  const labels: Record<string, string> = { name: w.name, event: w.event, method: w.method, url: w.url, headers: w.headers, payload: w.payload, expect: w.expect };
  const title = hook?.name ?? w.newTitle;
  const waiting = run.running && hook?.test && (hook.test.status === "pending" || hook.test.status === "running");
  const ev = hook?.event ?? "hof";
  const code = (v: string) => <code key={v}>{`{${v}}`}</code>;
  const list = (vs: readonly string[]) => vs.flatMap((v, i) => (i ? [", ", code(v)] : [code(v)]));
  // The placeholders of the chosen event, switched by CSS (no script needed).
  const css = EVENTS.map((e) => `form:not(:has(select[name="event"] option[value="${e}"]:checked)) [data-ev="${e}"]{display:none}`).join("\n");
  return (
    <>
      <PageHead
        crumbs={[[a.ui.areaSettings, "/admin/settings"], [n.title, "/admin/settings/notifications#webhooks"], [title]]}
        title={title}
        actions={
          <Link prefetch={false} className="button" href="/admin/settings/notifications#webhooks">
            ← {a.back}
          </Link>
        }
      />
      {sp.saved ? <p className="notice">{w.saved}</p> : null}
      {sp.bad ? <p className="notice error">{fill(w.bad, { f: labels[sp.bad] ?? sp.bad })}</p> : null}
      {sp.nojobs ? <p className="notice error">{n.noJobs}</p> : null}
      <style>{css}</style>
      <Section title={isNew ? w.newTitle : w.edit}>
        <form action={saveWebhookAction} className="form">
          <input type="hidden" name="id" value={id} />
          <label>
            {w.name}
            <input {...noAutofill} name="name" dir="auto" maxLength={64} required defaultValue={hook?.name ?? ""} aria-invalid={sp.bad === "name" || undefined} />
            <small>{w.nameHint}</small>
          </label>
          <label>
            {w.event}
            <select name="event" defaultValue={ev}>
              {NOTIFY_EVENT_LABELS.map(([e, l]) => (
                <option key={e} value={e}>
                  {tr(l, lang)}
                </option>
              ))}
            </select>
            <small>{w.eventHint}</small>
          </label>
          <label className="check">
            <input type="checkbox" name="enabled" value="1" defaultChecked={hook?.enabled ?? true} /> {w.enabled}
          </label>
          <small className="muted">{w.enabledHint}</small>
          <label>
            {w.method}
            <select name="method" defaultValue={hook?.method ?? "POST"}>
              {WEBHOOK_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <small>{w.methodHint}</small>
          </label>
          <label>
            {w.url}
            <input {...noAutofill} name="url" type="url" dir="ltr" maxLength={MAX_WEBHOOK_URL} required placeholder="https://example.org/hook" defaultValue={hook?.url ?? ""} aria-invalid={sp.bad === "url" || undefined} />
            <small>{w.urlHint}</small>
          </label>
          <div className="form-field">
            <b>{w.headers}</b>
            <small className="muted">{w.headersHint}</small>
            <WebhookHeaders initial={hook?.headers ?? []} max={MAX_WEBHOOK_HEADERS} text={{ name: w.headerName, value: w.headerValue, stored: w.stored, add: w.addHeader, remove: w.removeHeader }} />
          </div>
          <label>
            {w.expect}
            <input {...noAutofill} name="expect" type="number" min={100} max={599} step={1} placeholder="2xx" defaultValue={hook?.expect ? String(hook.expect) : ""} aria-invalid={sp.bad === "expect" || undefined} />
            <small>{w.expectHint}</small>
          </label>
          <label>
            {w.payload}
            <textarea {...noAutofill} name="payload" className="webhook-payload" dir="ltr" spellCheck={false} maxLength={MAX_WEBHOOK_TEXT} rows={8} defaultValue={hook?.payload ?? ""} placeholder={'{"text": "{title}\\n{body}"}'} aria-invalid={sp.bad === "payload" || undefined} />
            <small>{w.payloadHint}</small>
          </label>
          <div className="form-field">
            <b>{w.vars}</b>
            <p className="webhook-vars">
              {w.varsAll}
              {list(WEBHOOK_VARS)}
            </p>
            {EVENTS.map((e) => (
              <p key={e} className="webhook-vars" data-ev={e}>
                {w.varsEvent}
                {list(WEBHOOK_EVENT_VARS[e])}
                {e === "hof" ? ` ${w.varsN}` : null}
              </p>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" name="allow_private" value="1" defaultChecked={hook?.allowPrivate ?? false} /> {w.private}
          </label>
          <small className="muted">{w.privateHint}</small>
          <div className="btns">
            <button type="submit" className="button primary">
              {a.save}
            </button>
            <button type="submit" className="button" name="test" value="1" disabled={!jobs}>
              <Icon name="bell" />
              {w.saveTest}
            </button>
          </div>
        </form>
      </Section>
      {hook ? (
        <Section title={w.test} id="test">
          <div className="form">
            <p className="muted">{w.testIntro}</p>
            {!run.running ? <p className="notice">{n.noCollector}</p> : null}
            {sp.job && /^\d+$/.test(sp.job) ? <p className="notice" role="status">{fill(w.testQueued, { id: sp.job })}</p> : null}
            <WebhookStatusLine status={hook.status} test={hook.test} lang={lang} />
            {waiting ? <AutoRefresh seconds={3} /> : null}
          </div>
        </Section>
      ) : null}
      {hook ? (
        <Section title={a.delete} className="danger-zone">
          <form action={deleteWebhookAction} className="form">
            <p className="muted">{a.deleteHint}</p>
            <input type="hidden" name="id" value={hook.id} />
            <ConfirmButton label={a.delete} title={fill(w.deleteTitle, { n: hook.name })} yes={a.deleteYes} text={{ cancel: a.confirmCancel }}>
              <p>{w.deleteBody}</p>
            </ConfirmButton>
          </form>
        </Section>
      ) : null}
    </>
  );
}

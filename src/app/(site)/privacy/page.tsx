import type { Metadata } from "next";
import { headers } from "next/headers";
import { ConsentForm, type ConsentText } from "@/components/consent";
import { Section, TableWrap } from "@/components/ui";
import { CONSENT_CATEGORIES } from "@/lib/consent";
import { getConsent } from "@/lib/consent-server";
import { fill, getDict, type Dict } from "@/lib/i18n";
import { getPrivacyOptions } from "@/lib/privacy";
import { STORAGE, browserThirdParties, serverThirdParties, type ThirdPartyRow } from "@/lib/privacy-inventory";
import { textBlocks, type TextPart } from "@/lib/privacy-operator";
import { getSettings } from "@/lib/settings";
import { voiceKind } from "@/lib/voice";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.privacy.title };
}

type P = Dict["privacy"];

// Privacy page: the operator's part (Admin → Website → Privacy), the consent
// settings (also reached without JavaScript, from the banner's "Settings")
// and the lists the site builds itself (lib/privacy-inventory.ts).
export default async function PrivacyPage() {
  const [{ t }, consent, s, { operator, satellite }, voice, host] = await Promise.all([
    getDict(),
    getConsent(),
    getSettings(),
    getPrivacyOptions(),
    voiceKind(),
    headers().then((h) => h.get("host") ?? ""),
  ]);
  const p = t.privacy;
  const c = t.consent;
  const input = {
    mapStyle: s.mapStyle,
    satellite,
    maps: s.mapLive || s.mapPlayers,
    steamProfiles: s.steamProfiles,
    voice,
    sourcebans: !!s.sourcebansUrl,
    images: [s.logoUrl, s.headerLogo, s.favicon, s.appleIcon].filter(Boolean),
    ownHost: host,
  };
  const catName = { maps: c.catMaps, steam: c.catSteam };
  const chosen = CONSENT_CATEGORIES.filter((k) => consent[k]).map((k) => catName[k]);
  const current = !consent.answered ? p.consentNone : chosen.length ? chosen.join(", ") : p.consentOnlyNecessary;
  const hasOperator = !!(operator.name || operator.address || operator.email);

  return (
    <>
      <Section title={p.title}>
        <p className="lead">{p.intro}</p>
      </Section>
      <Section title={p.operatorTitle}>
        <div className="box privacy-text">
          {hasOperator ? (
            <address>
              {operator.name ? <b>{operator.name}</b> : null}
              {operator.address.split("\n").filter(Boolean).map((l, i) => (
                <span key={i}>{l}</span>
              ))}
              {operator.email ? (
                <span>
                  {p.email}: <a href={`mailto:${operator.email}`}>{operator.email}</a>
                </span>
              ) : null}
            </address>
          ) : (
            <p className="muted">{p.operatorMissing}</p>
          )}
          {textBlocks(operator.text).map((para, i) => (
            <p key={i}>
              {para.map((line, j) => (
                <span key={j}>
                  {j ? <br /> : null}
                  <Parts parts={line} />
                </span>
              ))}
            </p>
          ))}
        </div>
      </Section>
      <Section id="consent" title={p.consentTitle}>
        <div className="box privacy-text">
          <p>{p.consentIntro}</p>
          <p>
            <b>{fill(p.consentCurrent, { v: current })}</b>
          </p>
          <ConsentForm consent={consent} t={c as ConsentText} idPrefix="page" />
        </div>
      </Section>
      <Section title={p.storageTitle}>
        <p className="lead">{p.storageIntro}</p>
        <TableWrap>
          <table className="stats privacy-table">
            <thead>
              <tr>
                <th>{p.colName}</th>
                <th>{p.colKind}</th>
                <th>{p.colPurpose}</th>
                <th>{p.colDuration}</th>
                <th>{p.colCategory}</th>
              </tr>
            </thead>
            <tbody>
              {STORAGE.map((r) => (
                <tr key={r.name}>
                  <td className="mono">{r.name}</td>
                  <td>{r.kind === "cookie" ? p.kindCookie : p.kindLocal}</td>
                  <td>
                    {p[r.purpose as keyof P]}
                    {r.adminOnly ? <span className="muted"> ({p.adminOnly})</span> : null}
                  </td>
                  <td>{p[r.duration as keyof P]}</td>
                  <td>{r.category === "necessary" ? p.catNecessary : p.catPreference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Section>
      <Section title={p.browserTitle}>
        <p className="lead">{p.browserIntro}</p>
        <PartyTable rows={browserThirdParties(input)} p={p} catName={catName} consentCol />
      </Section>
      <Section title={p.serverTitle}>
        <p className="lead">{p.serverIntro}</p>
        <PartyTable rows={serverThirdParties(input)} p={p} catName={catName} />
      </Section>
      <Section title={p.logTitle}>
        <p className="lead">{p.logText}</p>
      </Section>
      <Section title={p.statsTitle}>
        <p className="lead">{p.statsText}</p>
      </Section>
      <Section title={p.rightsTitle}>
        <p className="lead">{p.rightsText}</p>
      </Section>
    </>
  );
}

function PartyTable({ rows, p, catName, consentCol = false }: { rows: ThirdPartyRow[]; p: P; catName: Record<string, string>; consentCol?: boolean }) {
  return (
    <TableWrap>
      <table className="stats privacy-table">
        <thead>
          <tr>
            <th>{p.colProvider}</th>
            <th>{p.colPurpose}</th>
            <th>{p.colData}</th>
            {consentCol ? <th>{p.colConsent}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.provider}-${r.purpose}`}>
              <td>
                {r.link ? (
                  <a href={r.link} rel="noopener noreferrer" target="_blank" title={p.colLink}>
                    {r.provider}
                  </a>
                ) : (
                  r.provider || p.operatorImages
                )}
                {r.hosts.length ? <small className="privacy-hosts">{r.hosts.join(", ")}</small> : null}
              </td>
              <td>{p[r.purpose as keyof P]}</td>
              <td>{p[r.data as keyof P]}</td>
              {consentCol ? <td>{r.consent ? `${p.consentYes} (${catName[r.consent]})` : p.consentNo}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </TableWrap>
  );
}

// A line of the operator's text: plain text and links, never HTML.
function Parts({ parts }: { parts: TextPart[] }) {
  return (
    <>
      {parts.map((x, i) =>
        "href" in x ? (
          <a key={i} href={x.href} rel="noopener noreferrer nofollow" target={x.href.startsWith("mailto:") ? undefined : "_blank"}>
            {x.text}
          </a>
        ) : (
          <span key={i}>{x.text}</span>
        ),
      )}
    </>
  );
}

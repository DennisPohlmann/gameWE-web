import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServerFlag } from "@/components/live";
import { SigCode } from "@/components/sig-code";
import { TsPassword } from "@/components/ts-password";
import { Empty, Flag, Section, Stats } from "@/components/ui";
import { fmtDateTime, fmtDuration, fmtNum } from "@/lib/format";
import { getDict, type Dict, type Lang } from "@/lib/i18n";
import { imageStyles } from "@/lib/image-theme";
import { statsOrigin } from "@/lib/site-url";
import { getVoiceDetail, type VoiceChannel, type VoiceOs } from "@/lib/voice";

export async function generateMetadata(): Promise<Metadata> {
  const [{ t }, v] = await Promise.all([getDict(), getVoiceDetail()]);
  return { title: v ? `${t.voiceServer}: ${v.box.name}` : t.voiceServer };
}

// Detail page of the TeamSpeak server from the voice server box, like
// TSViewer: channel tree with the people online, server data, traffic and
// the welcome message, and at the bottom the code of the TeamSpeak banner.
// Live from the ServerQuery, kept for a minute.
export default async function VoicePage() {
  const [{ lang, t }, v, origin] = await Promise.all([getDict(), getVoiceDetail(), statsOrigin()]);
  if (!v) notFound();
  const imgStyles = await imageStyles(lang === "de" ? "de" : "en");
  const { box, info } = v;
  const n = (x: number | null) => (x === null ? "-" : fmtNum(x, lang));
  return (
    <>
      <Section
        title={
          <>
            {box.country !== null ? <ServerFlag code={box.country} lang={lang} /> : null}
            {box.name}
          </>
        }
        aside={
          <a className="button" href={box.link}>
            {t.voiceConnect}
          </a>
        }
      >
        <Stats
          items={[
            [t.voiceType, box.type],
            [t.address, <a key="a" href={box.link}>{box.address}</a>],
            [t.password, <TsPassword key="p" password={box.password} passwordProtected={box.passwordProtected} t={t} />],
          ]}
        />
      </Section>
      {!v.ok ? (
        <Empty>{t.voiceUnavailable}</Empty>
      ) : (
        <Section title={t.voiceServerInfo}>
          <div className="cont-2">
            <div>
              <table className="stats">
                <thead>
                  <tr>
                    <th>{t.channels}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="voice-tree">
                      {v.channels.length ? <Channels list={v.channels} t={t} /> : <span className="muted">{t.noData}</span>}
                      {box.clients === 0 ? <p className="muted">{t.voiceNobody}</p> : null}
                      {!v.showClients ? <p className="muted">{t.voiceNamesHidden}</p> : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {info ? (
              <div className="voice-side">
                <Stats
                  title={t.voiceServerInfo}
                  items={[
                    [t.voiceOs, info.os ? <OsName key="os" os={info.os} /> : "-"],
                    [t.uptime, info.uptime === null ? "-" : fmtDuration(info.uptime)],
                    [t.channels, n(box.channels)],
                    [t.voiceUsersOnline, `${n(box.clients)}${box.max !== null ? `/${fmtNum(box.max, lang)}` : ""}`],
                    [t.voiceClientConnections, n(info.clientConnections)],
                    [t.voiceQueryConnections, n(info.queryConnections)],
                    [t.voiceSecurityLevel, n(info.securityLevel)],
                    [t.voicePing, info.ping === null ? "-" : `${fmtNum(info.ping, lang)} ms`],
                    [t.voicePacketLoss, info.packetLoss === null ? "-" : `${fmtNum(info.packetLoss * 100, lang, 2)} %`],
                    [t.voiceVersion, info.version || "-"],
                    [t.voiceCreated, info.created ? fmtDateTime(info.created, lang) : "-"],
                    [
                      t.voiceBannerUrl,
                      info.bannerUrl ? (
                        <a key="b" href={info.bannerUrl} target="_blank" rel="nofollow noopener noreferrer">
                          {info.bannerUrl}
                        </a>
                      ) : (
                        "-"
                      ),
                    ],
                  ]}
                />
                <Stats
                  title={t.voiceTraffic}
                  items={[
                    [t.voiceInPerSec, bytes(info.bandwidthIn, lang, "/s")],
                    [t.voiceOutPerSec, bytes(info.bandwidthOut, lang, "/s")],
                    [t.voiceInTotal, bytes(info.bytesIn, lang)],
                    [t.voiceOutTotal, bytes(info.bytesOut, lang)],
                  ]}
                />
                {info.welcome ? (
                  <table className="stats">
                    <thead>
                      <tr>
                        <th>{t.description}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="voice-welcome">{info.welcome}</td>
                      </tr>
                    </tbody>
                  </table>
                ) : null}
              </div>
            ) : null}
          </div>
        </Section>
      )}
      <Section title={t.voiceBanner}>
        <div className="box">
          <SigCode
            base={`${origin}/banner/teamspeak`}
            styles={imgStyles}
            link={`${origin}/voice`}
            alt={`${t.voiceBanner}: ${box.name}`}
            width={560}
            height={95}
            labels={{ format: t.sigFormat, style: t.imgStyle, standard: t.imgSkinDefault, url: t.sigImageUrl, copy: t.copy, copied: t.copied }}
          />
        </div>
      </Section>
    </>
  );
}

// Operating system of the server with a small symbol (drawn here, no logos).
function OsName({ os }: { os: VoiceOs }) {
  const icon =
    os === "Windows" ? (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className="os-icon">
        <path fill="#3c8de0" d="M1 2.5l6-.9V7.5H1zM8 1.4l7-1v7.1H8zM1 8.5h6v5.9l-6-.9zM8 8.5h7v7.1l-7-1z" />
      </svg>
    ) : os === "Linux" ? (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className="os-icon">
        <ellipse cx="8" cy="9.5" rx="5" ry="6" fill="#222" stroke="#ccc" strokeWidth="0.8" />
        <ellipse cx="8" cy="11" rx="3" ry="3.8" fill="#eee" />
        <circle cx="6.5" cy="6" r="0.9" fill="#fff" />
        <circle cx="9.5" cy="6" r="0.9" fill="#fff" />
        <path d="M6.6 7.6h2.8L8 9z" fill="#f5b400" />
      </svg>
    ) : os === "FreeBSD" ? (
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className="os-icon">
        <circle cx="8" cy="9" r="6" fill="#ab2b28" />
        <path d="M2.5 5.5L1 1l4 2.5zM13.5 5.5L15 1l-4 2.5z" fill="#ab2b28" />
      </svg>
    ) : null;
  return (
    <>
      {os} {icon}
    </>
  );
}

function bytes(v: number | null, lang: Lang, suffix = ""): string {
  if (v === null) return "-";
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let x = v;
  let i = 0;
  while (x >= 1024 && i < units.length - 1) {
    x /= 1024;
    i++;
  }
  return `${fmtNum(x, lang, i ? 2 : 0)} ${units[i]}${suffix}`;
}

function Channels({ list, t }: { list: VoiceChannel[]; t: Dict }) {
  return (
    <ul>
      {list.map((c) => (
        <li key={c.id}>
          {c.spacer ? (
            <div className={`voice-spacer ${c.spacer}`} aria-hidden={c.spacer === "repeat" || undefined}>
              {c.spacer === "repeat" ? c.name.repeat(Math.ceil(400 / Math.max(1, c.name.length))) : c.name}
            </div>
          ) : (
            <div className="voice-channel" title={c.topic || undefined}>
              <span className="voice-ch-icon" aria-hidden="true" /> {c.name}
              {c.password ? <span className="muted" title={t.password}> 🔒</span> : null}
              {c.count && !c.clients.length ? <span className="muted"> ({c.count})</span> : null}
            </div>
          )}
          {c.clients.length ? (
            <ul className="voice-clients">
              {c.clients.map((u, i) => (
                <li key={i} className={u.away ? "away" : undefined}>
                  <span className={`voice-user${u.deaf ? " deaf" : u.muted ? " muted" : ""}`} aria-hidden="true" /> {u.country ? <Flag code={u.country} /> : null}
                  {u.name}
                  {u.away ? <span className="muted"> ({t.voiceAway})</span> : null}
                  {u.deaf ? <span className="muted"> ({t.voiceDeaf})</span> : u.muted ? <span className="muted"> ({t.voiceMuted})</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {c.children.length ? <Channels list={c.children} t={t} /> : null}
        </li>
      ))}
    </ul>
  );
}

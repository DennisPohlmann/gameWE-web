import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Empty, Flag, Section, Stats } from "@/components/ui";
import { fmtDateTime, fmtDuration, fmtNum } from "@/lib/format";
import { getDict, type Dict, type Lang } from "@/lib/i18n";
import { getVoiceDetail, type VoiceChannel } from "@/lib/voice";

export async function generateMetadata(): Promise<Metadata> {
  const [{ t }, v] = await Promise.all([getDict(), getVoiceDetail()]);
  return { title: v ? `${t.voiceServer}: ${v.box.name}` : t.voiceServer };
}

// Detail page of the TeamSpeak server from the voice server box, like
// TSViewer: channel tree with the people online, server data, traffic and
// the welcome message. Live from the ServerQuery, kept for a minute.
export default async function VoicePage() {
  const [{ lang, t }, v] = await Promise.all([getDict(), getVoiceDetail()]);
  if (!v) notFound();
  const { box, info } = v;
  const n = (x: number | null) => (x === null ? "-" : fmtNum(x, lang));
  return (
    <>
      <Section
        title={
          <>
            <span className="voice-icon ts" aria-hidden="true" /> {box.name}
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
            [t.password, box.password || "-"],
            [t.voiceUsersOnline, `${n(box.clients)}${box.max !== null ? `/${fmtNum(box.max, lang)}` : ""}`],
          ]}
        />
      </Section>
      {!v.ok ? (
        <Empty>{t.voiceUnavailable}</Empty>
      ) : (
        <div className="cont-2">
          <Section title={t.channels}>
            <div className="box voice-tree">
              {v.channels.length ? <Channels list={v.channels} t={t} /> : <Empty>{t.noData}</Empty>}
              {box.clients === 0 ? <p className="muted">{t.voiceNobody}</p> : null}
              {!v.showClients ? <p className="muted">{t.voiceNamesHidden}</p> : null}
            </div>
          </Section>
          <div>
            {info ? (
              <>
                <Section title={t.voiceServerData}>
                  <Stats
                    items={[
                      [t.uptime, info.uptime === null ? "-" : fmtDuration(info.uptime)],
                      [t.channels, n(box.channels)],
                      [t.voiceClientConnections, n(info.clientConnections)],
                      [t.voiceQueryConnections, n(info.queryConnections)],
                      [t.voiceSecurityLevel, n(info.securityLevel)],
                      [t.voicePing, info.ping === null ? "-" : `${fmtNum(info.ping, lang)} ms`],
                      [t.voicePacketLoss, info.packetLoss === null ? "-" : `${fmtNum(info.packetLoss * 100, lang, 2)} %`],
                      [t.voiceVersion, [info.version, info.platform].filter(Boolean).join(" · ") || "-"],
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
                </Section>
                <Section title={t.voiceTraffic}>
                  <Stats
                    items={[
                      [t.voiceInPerSec, bytes(info.bandwidthIn, lang, "/s")],
                      [t.voiceOutPerSec, bytes(info.bandwidthOut, lang, "/s")],
                      [t.voiceInTotal, bytes(info.bytesIn, lang)],
                      [t.voiceOutTotal, bytes(info.bytesOut, lang)],
                    ]}
                  />
                </Section>
                {info.welcome ? (
                  <Section title={t.description}>
                    <div className="box voice-welcome">{info.welcome}</div>
                  </Section>
                ) : null}
              </>
            ) : null}
          </div>
        </div>
      )}
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
              {c.spacer === "repeat" ? c.name.repeat(Math.ceil(200 / Math.max(1, c.name.length))) : c.name}
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
                  <span className={`voice-user${u.deaf ? " deaf" : u.muted ? " muted" : ""}`} aria-hidden="true" /> {u.name}
                  {u.country ? <> <Flag code={u.country} /></> : null}
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

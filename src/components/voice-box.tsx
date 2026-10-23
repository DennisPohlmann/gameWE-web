import { NotOnAdmin } from "./not-on-admin";
import { fmtNum } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";
import type { VoiceBox as Box } from "@/lib/voice";

// gameME's "Voiceserver" box: TeamSpeak and Discord with the people online.
export function VoiceBox({ box, t, lang }: { box: Box; t: Dict; lang: Lang }) {
  if (!box.ts && !box.discord) return null;
  const n = (v: number | null) => (v === null ? "–" : fmtNum(v, lang));
  return (
    <NotOnAdmin>
      <section className="block voice-box">
        <h3>{t.voiceServer}</h3>
        <div className="container">
          <table>
            <thead>
              <tr>
                <th>{t.server}</th>
                <th>{t.address}</th>
                <th className="hide-sm">{t.password}</th>
                <th className="num hide-sm">{t.channels}</th>
                <th className="num">{t.players}</th>
              </tr>
            </thead>
            <tbody>
              {box.ts ? (
                <tr>
                  <td>
                    <span className="voice-icon ts" aria-hidden="true" /> {box.ts.name}
                  </td>
                  <td>
                    <a href={`ts3server://${box.ts.address.replace(/:(\d+)$/, "?port=$1")}`}>{box.ts.address}</a>
                  </td>
                  <td className="hide-sm">{box.ts.password || "-"}</td>
                  <td className="num hide-sm">{n(box.ts.channels)}</td>
                  <td className="num">
                    {n(box.ts.clients)}
                    {box.ts.max !== null ? `/${fmtNum(box.ts.max, lang)}` : ""}
                  </td>
                </tr>
              ) : null}
              {box.discord ? (
                <tr>
                  <td>
                    <span className="voice-icon discord" aria-hidden="true" /> {box.discord.name}
                  </td>
                  <td>
                    {box.discord.invite ? (
                      <a href={box.discord.invite} target="_blank" rel="noopener noreferrer">
                        {box.discord.invite.replace(/^https:\/\//, "")}
                      </a>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td className="hide-sm">-</td>
                  <td className="num hide-sm">–</td>
                  <td className="num">{box.discord.online === null ? "–" : `${fmtNum(box.discord.online, lang)} ${t.online}`}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </NotOnAdmin>
  );
}

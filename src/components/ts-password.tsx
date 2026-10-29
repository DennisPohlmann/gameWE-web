import type { Dict } from "@/lib/i18n";

// The TeamSpeak server password in the voice box and on /voice: "-" without
// one, else a lock. Only when the admin allows showing it (getVoiceBox and
// getVoiceDetail then pass it) the lock opens on a click or tap and shows
// it (<details>, no script needed); otherwise the password is not in the
// page at all.
export function TsPassword({ password, passwordProtected, t }: { password: string; passwordProtected: boolean; t: Pick<Dict, "voicePasswordProtected" | "voicePasswordShow"> }) {
  if (!passwordProtected) return <>-</>;
  if (!password) {
    return (
      <span className="ts-lock" title={t.voicePasswordProtected} role="img" aria-label={t.voicePasswordProtected}>
        <LockIcon />
      </span>
    );
  }
  return (
    <details className="ts-lock">
      <summary title={t.voicePasswordShow} aria-label={t.voicePasswordShow}>
        <LockIcon />
      </summary>
      <code className="ts-password">{password}</code>
    </details>
  );
}

function LockIcon() {
  return (
    <svg className="ts-lock-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M8 1a4 4 0 0 0-4 4v2H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4Zm-2.5 4a2.5 2.5 0 0 1 5 0v2h-5V5Zm2.5 4.5a1.25 1.25 0 0 1 .6 2.35V13h-1.2v-1.15A1.25 1.25 0 0 1 8 9.5Z" />
    </svg>
  );
}

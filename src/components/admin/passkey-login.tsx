"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { b64u, unb64u } from "./b64url";
import { passkeyLoginAction, passkeyLoginStartAction } from "@/app/admin/actions";

// "Sign in with a passkey" on the login page: the browser offers the
// passkeys it has for this site; no user name is asked. On success the
// server action has signed in and the page goes on to /admin.
export type PasskeyLoginText = { button: string; unsupported: string; failed: string; errors: Record<"invalid" | "expired" | "blocked" | "nosecret", string> };

export function PasskeyLogin({ text, disabled }: { text: PasskeyLoginText; disabled?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const go = async () => {
    setError(null);
    if (!window.PublicKeyCredential) return setError(text.unsupported);
    setBusy(true);
    try {
      const o = await passkeyLoginStartAction();
      if ("error" in o) return setError(text.errors[o.error]);
      const c = (await navigator.credentials.get({
        publicKey: { challenge: unb64u(o.challenge), rpId: o.rpId, userVerification: "required", timeout: 300_000 },
      })) as PublicKeyCredential | null;
      if (!c) return setError(text.failed);
      const r = c.response as AuthenticatorAssertionResponse;
      const res = await passkeyLoginAction({
        id: b64u(c.rawId),
        clientDataJSON: b64u(r.clientDataJSON),
        authenticatorData: b64u(r.authenticatorData),
        signature: b64u(r.signature),
        userHandle: r.userHandle ? b64u(r.userHandle) : null,
      });
      if (res.error) return setError(text.errors[res.error]);
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      // Cancelled by the user, timed out, or no passkey for this site.
      setError(err instanceof DOMException && err.name === "SecurityError" ? text.unsupported : text.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="passkey-login">
      {error ? <p className="notice error">{error}</p> : null}
      <button type="button" className="button" onClick={go} disabled={busy || disabled}>
        {text.button}
      </button>
    </div>
  );
}

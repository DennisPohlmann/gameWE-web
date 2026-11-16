"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { b64u, unb64u } from "./b64url";
import { passkeyAddAction, passkeyAddStartAction, type PasskeyAddError } from "@/app/admin/actions";
import { noAutofill } from "@/lib/autofill";
import { RevealInput } from "./reveal-input";

// Adding a passkey (Admin → My account → Passkeys): a name and the password
// (and TOTP code) to confirm, then the browser makes the passkey on this
// device, a phone or a security key. Needs JavaScript and https.
export type PasskeyAddText = {
  name: string;
  nameHint: string;
  password: string;
  show: string;
  hide: string;
  code: string;
  add: string;
  added: string;
  unsupported: string;
  failed: string;
  errors: Record<PasskeyAddError, string>;
};

export function PasskeyAdd({ text, totp }: { text: PasskeyAddText; totp: boolean }) {
  const [msg, setMsg] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    const fail = (t: string) => setMsg({ error: true, text: t });
    if (!window.PublicKeyCredential) return fail(text.unsupported);
    const data = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const o = await passkeyAddStartAction(data);
      if ("error" in o) return fail(text.errors[o.error]);
      const c = (await navigator.credentials.create({
        publicKey: {
          challenge: unb64u(o.challenge),
          rp: { id: o.rpId, name: o.rpName },
          user: { id: unb64u(o.user.id), name: o.user.name, displayName: o.user.name },
          pubKeyCredParams: o.algs.map((alg) => ({ type: "public-key" as const, alg })),
          excludeCredentials: o.exclude.map((id) => ({ type: "public-key" as const, id: unb64u(id) })),
          authenticatorSelection: { residentKey: "required", requireResidentKey: true, userVerification: "required" },
          attestation: "none",
          timeout: 300_000,
        },
      })) as PublicKeyCredential | null;
      const r = c?.response as AuthenticatorAttestationResponse | undefined;
      const key = r?.getPublicKey?.();
      if (!c || !r || !key) return fail(text.failed);
      const res = await passkeyAddAction(String(data.get("name") ?? ""), {
        clientDataJSON: b64u(r.clientDataJSON),
        authenticatorData: b64u(r.getAuthenticatorData()),
        publicKey: b64u(key),
        alg: r.getPublicKeyAlgorithm(),
      });
      if (res.error) return fail(text.errors[res.error]);
      form.current?.reset();
      setMsg({ error: false, text: text.added });
      // The list shows the new passkey marked, with its name in the notice.
      router.replace(`/admin/account?pk=added&new=${encodeURIComponent(res.added ?? "")}#passkeys`);
    } catch (err) {
      // InvalidStateError: this device already has a passkey of the account.
      fail(err instanceof DOMException && err.name === "InvalidStateError" ? text.errors.duplicate : err instanceof DOMException && err.name === "SecurityError" ? text.unsupported : text.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {msg ? <p className={msg.error ? "notice error" : "notice"}>{msg.text}</p> : null}
      <form ref={form} onSubmit={submit} className="form">
        <label>
          {text.name}
          <input {...noAutofill} name="name" dir="auto" maxLength={40} required />
          <small>{text.nameHint}</small>
        </label>
        <label>
          {text.password}
          <RevealInput show={text.show} hide={text.hide} name="password" autoComplete="current-password" required />
        </label>
        {totp ? (
          <label>
            {text.code}
            <input name="code" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} maxLength={12} required />
          </label>
        ) : null}
        <button type="submit" className="button" disabled={busy}>
          {text.add}
        </button>
      </form>
    </>
  );
}

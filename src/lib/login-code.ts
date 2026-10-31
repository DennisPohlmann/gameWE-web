// Second step of the admin login: the page shows either the field for the
// code from the authenticator app or the one for a backup code, never both.
// The choice lives in the URL (?use=backup) so it works without JavaScript
// and survives the redirect after a wrong code. It only picks the field;
// loginCode() checks every code the same way.

export type CodeMode = "totp" | "backup";

export function codeMode(use: unknown): CodeMode {
  return use === "backup" ? "backup" : "totp";
}

// Login page of the code step in the given mode, optionally with an error.
export function codeStepHref(mode: CodeMode, error?: string): string {
  const q = new URLSearchParams({ step: "code" });
  if (mode === "backup") q.set("use", "backup");
  if (error) q.set("error", error);
  return `/admin/login?${q}`;
}

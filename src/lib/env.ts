// Reads an environment variable. Surrounding quotes are removed, because the
// same web.env file is read by systemd and the shell (which strip them) and by
// `docker run --env-file` (which does not).
export function env(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  const m = /^(["'])(.*)\1$/s.exec(v.trim());
  return m ? m[2] : v.trim();
}

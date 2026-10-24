// The log secret of a game server (hlstats_Servers.log_secret, sv_logsecret).
// The Source engine reads sv_logsecret as a number (a value that is not one,
// or 0, sends no secret), so the collector accepts only 1..2147483647 without
// leading zeros; the web admin checks the same.

export const LOG_SECRET_MAX = 2147483647;

export function isLogSecret(s: string): boolean {
  return /^[1-9][0-9]{0,9}$/.test(s) && Number(s) <= LOG_SECRET_MAX;
}

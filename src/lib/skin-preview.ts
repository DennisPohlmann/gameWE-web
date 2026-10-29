// Screenshot runs only (scripts/skin-shots.mjs): with SKIN_PREVIEW=on in the
// environment the cookie gamewe_skin_preview picks the template of the public
// pages instead of Admin > Settings, so one running server can show every
// skin at the same time without touching the database or waiting for the
// settings cache. Off (the default) the cookie is ignored. Only the template
// changes; an unknown or retired name falls back like the setting does
// (resolveTemplate). No server-only import, so the tests can load it.
export const SKIN_PREVIEW_COOKIE = "gamewe_skin_preview";
const ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export function previewSkinOf(cookie: string | undefined, setting: string | undefined): string | null {
  return setting?.trim() === "on" && cookie && ID.test(cookie) ? cookie : null;
}

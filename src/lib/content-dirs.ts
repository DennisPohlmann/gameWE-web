// The folders of your own next to the built-in templates/ and overviews/:
// fixed paths, the same for a package install and in the container (mount
// points there), see docs/INSTALLATION.md. The release archives of
// gameWE-web-content unpack straight into them.
export const OWN_TEMPLATES = "/var/lib/gamewe/web/templates";
export const OWN_OVERVIEWS = "/var/lib/gamewe/web/overviews";

// TEMPLATES_DIR and OVERVIEWS_DIR named these folders up to v0.35. Still set,
// they are ignored; the warning says where the folder belongs now.
export function retiredDirWarning(name: string, value: string | undefined, fixed: string): string | null {
  if (!value) return null;
  const same = value.replace(/\/+$/, "") === fixed;
  return same
    ? `${name} is no longer read, ${fixed} is always used: remove ${name} from web.env`
    : `${name}=${value.replace(/[\u0000-\u001f\u007f]/g, "")} is ignored (removed in v0.36): own files are only read from ${fixed}, move or mount the folder there`;
}

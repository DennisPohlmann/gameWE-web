// Tabs in the site header: the built-in pages, SourceBans, the own links
// (gamewe_link_1 .. gamewe_link_6, "Label|URL") and their order
// (gamewe_header_order, comma-separated ids). No imports, so the admin form
// (client), the settings (server) and the tests (node --test) share it.

export const LINK_SLOTS = 6;

// Built-in tabs: Home can get its own label and address
// (gamewe_header_home, "Label|URL"), the others can only be moved.
export const BUILTIN_TABS = ["home", "search", "help", "licenses", "privacy", "sourcebans"] as const;
export type BuiltinTab = (typeof BUILTIN_TABS)[number];
export type TabId = BuiltinTab | `link${number}`;

// Order of older installations, which had no gamewe_header_order: the
// built-in tabs, SourceBans, then the own links by slot.
export const DEFAULT_ORDER: TabId[] = [...BUILTIN_TABS, ...Array.from({ length: LINK_SLOTS }, (_, i) => `link${i + 1}` as TabId)];

export type HeaderLink = { label: string; url: string };

// Only http(s) URLs and site paths, so a setting cannot inject javascript: links.
export function safeUrl(v: string | undefined): string {
  const s = (v ?? "").trim();
  return /^(https?:\/\/|\/)/i.test(s) ? s : "";
}

// The stored order with every id exactly once: unknown and repeated ids are
// dropped, missing ones (new installation, slots added later) follow in the
// default order. Privacy, added later than the others, goes right after
// Licenses when a stored order lacks it.
export function headerOrder(v: string | undefined): TabId[] {
  const known = new Set<string>(DEFAULT_ORDER);
  const seen = new Set<string>();
  for (const id of (v ?? "").split(",")) {
    const s = id.trim().toLowerCase();
    if (known.has(s)) seen.add(s);
  }
  const order = [...seen] as TabId[];
  const at = order.indexOf("licenses");
  if (at >= 0 && !seen.has("privacy")) order.splice(at + 1, 0, "privacy");
  return [...order, ...DEFAULT_ORDER.filter((id) => !order.includes(id))];
}

// A stored tab address: like safeUrl, but no protocol-relative "//host",
// which would leave the site in the same tab.
function tabUrl(v: string | undefined): string {
  const s = safeUrl(v);
  return s.startsWith("//") ? "" : s;
}

// "Label|URL" as stored; null when one part is missing or the address unsafe.
export function parseLink(v: string | undefined): HeaderLink | null {
  const [label, url] = (v ?? "").split("|").map((x) => x.trim());
  const safe = tabUrl(url);
  return label && safe ? { label, url: safe } : null;
}

// Home: both parts optional (empty label: the translated "Contents", empty
// address: the start page of the statistics).
export function parseHome(v: string | undefined): HeaderLink {
  const [label = "", url = ""] = (v ?? "").split("|").map((x) => x.trim());
  return { label: label.slice(0, 60), url: tabUrl(url) };
}

// Why a link from the form is not valid, or null when it is.
export type LinkProblem = "label" | "url" | "both" | "long";

function checkUrl(url: string): string | null {
  let u = url.trim();
  if (u.startsWith("/")) return /^\/[^\s|]*$/.test(u) && !u.startsWith("//") ? u : null;
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const parsed = new URL(u);
    const hostOk = /^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(parsed.hostname) || /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname);
    return hostOk && !u.includes("|") && !/\s/.test(u) && u.length <= 190 ? u : null;
  } catch {
    return null;
  }
}

export function linkProblem(label: string, url: string): LinkProblem | null {
  const name = label.trim();
  const u = url.trim();
  if (!name && !u) return null;
  if (!name) return "label";
  if (name.includes("|") || name.length > 60) return "long";
  if (!u) return "url";
  return checkUrl(u) ? null : "both";
}

// A header link from the two form fields: "" when both are empty, null when
// only one is filled in or the address is not a web address or site path.
// "www.example.org" becomes https://www.example.org.
export function linkValue(label: string, url: string): string | null {
  const name = label.trim();
  if (!name && !url.trim()) return "";
  if (linkProblem(label, url)) return null;
  return `${name}|${checkUrl(url)}`;
}

// Home from the form: "" (all defaults), or "Label|URL" with either part empty.
export function homeValue(label: string, url: string): string | null {
  const name = label.trim();
  const u = url.trim();
  if (!name && !u) return "";
  if (name.includes("|") || name.length > 60) return null;
  if (!u) return `${name}|`;
  const checked = checkUrl(u);
  return checked ? `${name}|${checked}` : null;
}

export type HeaderTab = {
  id: TabId;
  label: string;
  href: string;
  // Built-in pages go through next/link (base path); own addresses are
  // plain links, external ones open in a new tab.
  kind: "page" | "path" | "external";
};

// The tabs in the saved order. SourceBans only when configured and no own
// link already points there.
export function headerTabs(
  s: { order: TabId[]; home: HeaderLink; links: (HeaderLink | null)[]; sourcebansUrl: string },
  t: { home: string; search: string; help: string; licenses: string; privacy: string },
): HeaderTab[] {
  const own = s.links.filter((l): l is HeaderLink => l !== null);
  const sbLinked = own.some((l) => l.url.replace(/\/?(index\.php)?$/i, "/") === s.sourcebansUrl || /^sourcebans$/i.test(l.label));
  const tabs: HeaderTab[] = [];
  for (const id of s.order) {
    if (id === "home") {
      const url = s.home.url;
      tabs.push({ id, label: s.home.label || t.home, href: url || "/", kind: !url || url === "/" ? "page" : url.startsWith("/") ? "path" : "external" });
    } else if (id === "search" || id === "help" || id === "licenses" || id === "privacy") {
      tabs.push({ id, label: t[id], href: `/${id}`, kind: "page" });
    } else if (id === "sourcebans") {
      if (s.sourcebansUrl && !sbLinked) tabs.push({ id, label: "SourceBans", href: s.sourcebansUrl, kind: "external" });
    } else {
      const l = s.links[Number(id.slice(4)) - 1];
      if (l) tabs.push({ id, label: l.label, href: l.url, kind: l.url.startsWith("/") ? "path" : "external" });
    }
  }
  return tabs;
}

// Whether a tab is the page being shown (marked in the phone menu). Only the
// site's own pages can be: "/" just on the start page, the others also on
// their sub-pages.
export function isCurrentTab(tab: Pick<HeaderTab, "href" | "kind">, path: string): boolean {
  if (tab.kind !== "page") return false;
  return tab.href === "/" ? path === "/" : path === tab.href || path.startsWith(`${tab.href}/`);
}

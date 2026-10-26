// The operator's part of the privacy page (Admin → Website → Privacy):
// controller's name, postal address, contact e-mail and an optional free
// text. Kept in hlstats_Options like every other setting; the free text is
// longer than one value (varchar(255), varchar(128) in old HLstatsX:CE
// tables), so it is split over the keys gamewe_privacy_text_1 .. _N.
// Pure functions: the admin action, the page and the tests use them.

export const OPERATOR_KEYS = {
  name: "gamewe_privacy_name",
  address: "gamewe_privacy_address",
  email: "gamewe_privacy_email",
} as const;
export const TEXT_CHUNK = 120;
export const TEXT_CHUNKS = 25;
export const TEXT_MAX = TEXT_CHUNK * TEXT_CHUNKS;
export const textKey = (i: number) => `gamewe_privacy_text_${i + 1}`;
export const ALL_OPERATOR_KEYS = [...Object.values(OPERATOR_KEYS), ...Array.from({ length: TEXT_CHUNKS }, (_, i) => textKey(i))];

export const LIMITS = { name: 120, address: 120, email: 120 } as const;

export type Operator = { name: string; address: string; email: string; text: string };
export const EMPTY_OPERATOR: Operator = { name: "", address: "", email: "", text: "" };

// Line breaks as \n; no other control characters, no zero-width or
// direction marks that could hide or turn text around.
export function cleanText(v: string): string {
  return v
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanLine(v: string): string {
  return cleanText(v).replace(/\s+/g, " ");
}

export function validEmail(v: string): boolean {
  return /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)+$/.test(v);
}

// Code points, so a character outside the BMP (emoji) is never cut in two.
export function splitText(text: string): string[] {
  const cps = Array.from(text);
  return Array.from({ length: TEXT_CHUNKS }, (_, i) => cps.slice(i * TEXT_CHUNK, (i + 1) * TEXT_CHUNK).join(""));
}

export function readOperator(o: Record<string, string | undefined>): Operator {
  return {
    name: o[OPERATOR_KEYS.name] ?? "",
    address: o[OPERATOR_KEYS.address] ?? "",
    email: o[OPERATOR_KEYS.email] ?? "",
    text: Array.from({ length: TEXT_CHUNKS }, (_, i) => o[textKey(i)] ?? "").join(""),
  };
}

// The rows to write for a sent form, or the name of the first bad field.
export function operatorValues(form: { get(name: string): unknown }): { values: [string, string][] } | { field: keyof Operator } {
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };
  const name = cleanLine(str("name"));
  const address = cleanText(str("address"));
  const email = cleanLine(str("email"));
  const text = cleanText(str("text"));
  if (Array.from(name).length > LIMITS.name) return { field: "name" };
  if (Array.from(address).length > LIMITS.address || address.split("\n").length > 6) return { field: "address" };
  if (email && (email.length > LIMITS.email || !validEmail(email))) return { field: "email" };
  if (Array.from(text).length > TEXT_MAX) return { field: "text" };
  const chunks = splitText(text);
  return {
    values: [
      [OPERATOR_KEYS.name, name],
      [OPERATOR_KEYS.address, address],
      [OPERATOR_KEYS.email, email],
      ...chunks.map((c, i): [string, string] => [textKey(i), c]),
    ],
  };
}

// The free text as paragraphs (blank lines) of lines; inside a line the
// http(s) addresses and e-mail addresses become links. Rendered as React
// text nodes, never as HTML.
export type TextPart = { text: string } | { href: string; text: string };

export function textBlocks(text: string): TextPart[][][] {
  return cleanText(text)
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => p.split("\n").map(linkParts));
}

const LINK = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])|([^\s@<>()[\]\\,;:"']{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g;

export function linkParts(line: string): TextPart[] {
  const out: TextPart[] = [];
  let at = 0;
  for (const m of line.matchAll(LINK)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ text: line.slice(at, i) });
    if (m[1]) out.push({ href: m[1], text: m[1] });
    else if (validEmail(m[2])) out.push({ href: `mailto:${m[2]}`, text: m[2] });
    else out.push({ text: m[2] });
    at = i + m[0].length;
  }
  if (at < line.length) out.push({ text: line.slice(at) });
  return out;
}

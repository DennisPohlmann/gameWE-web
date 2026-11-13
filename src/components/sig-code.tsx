"use client";

import { useState } from "react";
import { noAutofill } from "@/lib/autofill";

// A generated picture (forum signature, server banner) with its code: the
// kind of code in a row of buttons (BBCode for forums, HTML, Discord, the
// bare image URL, an <iframe> of the HTML banner in the chosen size; the
// forums that take each one as tooltip), and four
// selects: the size, the layout (only for the normal size), the colours (one
// per design template, the site's own first) and the background pattern
// (?size=, ?layout=, ?bg=, lib/banners/options.ts, left out at their
// defaults, the first of each list); the preview and
// the code follow, with a copy button. Discord shows no image inside a link
// in a message, so its code is a masked link to the page with <> around the
// URL (no preview card of the page) and the image URL on its own line, which
// Discord shows as the picture.
export function SigCode({
  base,
  styles,
  sizes,
  layouts,
  backgrounds,
  link,
  alt,
  labels,
}: {
  // Absolute URL without ".png": <base>.png is the site's style, <base>-<style>.png another one.
  base: string;
  styles: { id: string; name: string }[];
  sizes: { id: string; name: string; width: number; height: number }[];
  layouts: { id: string; name: string }[];
  backgrounds: { id: string; name: string }[];
  link: string;
  alt: string;
  labels: { format: string; style: string; standard: string; size: string; layout: string; background: string; url: string; copy: string; copied: string };
}) {
  const [kind, setKind] = useState("bbcode");
  const [style, setStyle] = useState("");
  const [size, setSize] = useState(sizes[0]?.id ?? "");
  const [layout, setLayout] = useState(layouts[0]?.id ?? "");
  const [bg, setBg] = useState(backgrounds[0]?.id ?? "");
  const [copied, setCopied] = useState(false);
  const { width, height } = sizes.find((x) => x.id === size) ?? sizes[0];
  const normal = size === sizes[0]?.id;
  const q = new URLSearchParams();
  if (!normal) q.set("size", size);
  if (normal && layout !== layouts[0]?.id) q.set("layout", layout);
  if (bg !== backgrounds[0]?.id) q.set("bg", bg);
  const qs = q.toString();
  const img = `${style ? `${base}-${style}.png` : `${base}.png`}${qs ? `?${qs}` : ""}`;
  const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  // The link text in Discord: the name after "Forum signature: " (the alt
  // text), without the brackets of the link syntax.
  const linkText = (alt.includes(": ") ? alt.slice(alt.indexOf(": ") + 2) : alt).replace(/[[\]\\]/g, "");
  const html = `<a href="${attr(link)}"><img src="${attr(img)}" alt="${attr(alt)}" width="${width}" height="${height}"></a>`;
  // The HTML banner (lib/banners/wide-banner.tsx) with the same choices; without ?size= it is the tall one.
  const hq = new URLSearchParams(q);
  if (normal) hq.set("size", size);
  const page = `${style ? `${base}-${style}.html` : `${base}.html`}?${hq}`;
  const iframe = `<iframe src="${attr(page)}" title="${attr(alt)}" width="${width}" height="${height}" style="border:0" scrolling="no"></iframe>`;
  // [label, code, tooltip]
  const codes: Record<string, [string, string, string]> = {
    bbcode: ["BBCode", `[url=${link}][img]${img}[/img][/url]`, "phpBB, SMF, MyBB, XenForo, vBulletin, Invision"],
    html: ["HTML", html, "Websites, Invision"],
    discord: ["Discord", `[${linkText}](<${link}>)\n${img}`, "Discord"],
    url: [labels.url, img, labels.url],
    iframe: ["iframe", iframe, "Websites (live)"],
  };
  const code = codes[kind][1];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <div className="sig-codes">
      {kind === "iframe" ? (
        <iframe className="sig" src={page} title={alt} width={width} height={height} style={{ border: 0 }} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="sig" src={img} alt={alt} width={width} height={height} />
      )}
      <div className="sig-formats" role="group" aria-label={labels.format}>
        {Object.entries(codes).map(([k, [label, , hint]]) => (
          <button key={k} type="button" aria-pressed={k === kind} title={hint} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>
      <textarea {...noAutofill} className="sig-code" readOnly rows={3} value={code} onFocus={(e) => e.currentTarget.select()} />
      <div className="sig-codes-bar">
        <select {...noAutofill} value={size} onChange={(e) => setSize(e.target.value)} aria-label={labels.size} title={labels.size}>
          {sizes.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <select {...noAutofill} value={layout} onChange={(e) => setLayout(e.target.value)} disabled={!normal} aria-label={labels.layout} title={labels.layout}>
          {layouts.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
        <select {...noAutofill} value={style} onChange={(e) => setStyle(e.target.value)} aria-label={labels.style} title={labels.style}>
          <option value="">{labels.standard}</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select {...noAutofill} value={bg} onChange={(e) => setBg(e.target.value)} aria-label={labels.background} title={labels.background}>
          {backgrounds.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={copy}>
          {copied ? labels.copied : labels.copy}
        </button>
      </div>
    </div>
  );
}

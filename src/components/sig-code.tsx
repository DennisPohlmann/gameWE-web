"use client";

import { useState } from "react";
import { noAutofill } from "@/lib/autofill";

// A generated picture (forum signature, server banner) with its code: the
// kind of code in a row of buttons (BBCode for forums, HTML, Discord, the
// bare image URL; the forums that take each one as tooltip), the style (one
// per design template, the site's own first) in a select; the preview and
// the code follow, with a copy button. Discord shows no image inside a link
// in a message, so its code is a masked link to the page with <> around the
// URL (no preview card of the page) and the image URL on its own line, which
// Discord shows as the picture.
export function SigCode({
  base,
  styles,
  link,
  alt,
  width,
  height,
  labels,
}: {
  // Absolute URL without ".png": <base>.png is the site's style, <base>-<style>.png another one.
  base: string;
  styles: { id: string; name: string }[];
  link: string;
  alt: string;
  width: number;
  height: number;
  labels: { format: string; style: string; standard: string; url: string; copy: string; copied: string };
}) {
  const [kind, setKind] = useState("bbcode");
  const [style, setStyle] = useState("");
  const [copied, setCopied] = useState(false);
  const img = style ? `${base}-${style}.png` : `${base}.png`;
  const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  // The link text in Discord: the name after "Forum signature: " (the alt
  // text), without the brackets of the link syntax.
  const linkText = (alt.includes(": ") ? alt.slice(alt.indexOf(": ") + 2) : alt).replace(/[[\]\\]/g, "");
  const html = `<a href="${attr(link)}"><img src="${attr(img)}" alt="${attr(alt)}" width="${width}" height="${height}"></a>`;
  // [label, code, tooltip]
  const codes: Record<string, [string, string, string]> = {
    bbcode: ["BBCode", `[url=${link}][img]${img}[/img][/url]`, "phpBB, SMF, MyBB, XenForo, vBulletin, Invision"],
    html: ["HTML", html, "Websites, Invision"],
    discord: ["Discord", `[${linkText}](<${link}>)\n${img}`, "Discord"],
    url: [labels.url, img, labels.url],
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="sig" src={img} alt={alt} width={width} height={height} />
      <div className="sig-formats" role="group" aria-label={labels.format}>
        {Object.entries(codes).map(([k, [label, , hint]]) => (
          <button key={k} type="button" aria-pressed={k === kind} title={hint} onClick={() => setKind(k)}>
            {label}
          </button>
        ))}
      </div>
      <textarea {...noAutofill} className="sig-code" readOnly rows={3} value={code} onFocus={(e) => e.currentTarget.select()} />
      <div className="sig-codes-bar">
        <select {...noAutofill} value={style} onChange={(e) => setStyle(e.target.value)} aria-label={labels.style}>
          <option value="">{labels.standard}</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
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

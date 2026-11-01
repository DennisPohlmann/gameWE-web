"use client";

import { useState } from "react";
import { noAutofill } from "@/lib/autofill";

// A generated picture (forum signature, server banner) with its code: the
// format is picked by where it goes (buttons named after the forums and
// sites: phpBB/SMF/MyBB and XenForo take BBCode, Invision and websites HTML,
// Discord the image URL with the link in <> so it shows no second preview,
// or the bare image URL), the style (one per design template, the site's own
// first) in a select; the preview and the code follow, with a copy button.
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
  const [kind, setKind] = useState("phpbb");
  const [style, setStyle] = useState("");
  const [copied, setCopied] = useState(false);
  const img = style ? `${base}-${style}.png` : `${base}.png`;
  const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html = `<a href="${attr(link)}"><img src="${attr(img)}" alt="${attr(alt)}" width="${width}" height="${height}"></a>`;
  const codes: Record<string, [string, string]> = {
    phpbb: ["phpBB, SMF, MyBB", `[url=${link}][img]${img}[/img][/url]`],
    xenforo: ["XenForo", `[URL=${link}][IMG]${img}[/IMG][/URL]`],
    invision: ["Invision", html],
    html: ["HTML", html],
    discord: ["Discord", `${img}\n<${link}>`],
    url: [labels.url, img],
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
        {Object.entries(codes).map(([k, [label]]) => (
          <button key={k} type="button" aria-pressed={k === kind} onClick={() => setKind(k)}>
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

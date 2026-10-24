"use client";

import { useState } from "react";
import { noAutofill } from "@/lib/autofill";

// A generated picture (forum signature, server banner) with its code: the
// style (one per design template, the site's own first) and the format
// (BBCode, HTML, Markdown or the bare image URL) are picked in selects, the
// preview and the code follow, with a copy button.
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
  const codes: Record<string, [string, string]> = {
    bbcode: ["BBCode", `[url=${link}][img]${img}[/img][/url]`],
    html: ["HTML", `<a href="${attr(link)}"><img src="${attr(img)}" alt="${attr(alt)}" width="${width}" height="${height}"></a>`],
    markdown: ["Markdown", `[![${alt.replace(/[[\]]/g, "")}](${img})](${link})`],
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
      <div className="sig-codes-bar">
        <select {...noAutofill} value={style} onChange={(e) => setStyle(e.target.value)} aria-label={labels.style}>
          <option value="">{labels.standard}</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select {...noAutofill} value={kind} onChange={(e) => setKind(e.target.value)} aria-label={labels.format}>
          {Object.entries(codes).map(([k, [label]]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" onClick={copy}>
          {copied ? labels.copied : labels.copy}
        </button>
      </div>
      <textarea {...noAutofill} className="sig-code" readOnly rows={2} value={code} onFocus={(e) => e.currentTarget.select()} />
    </div>
  );
}

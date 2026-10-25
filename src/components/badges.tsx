// Rank insignia and award ribbons, drawn with SVG and CSS (no images).

import type { CSSProperties } from "react";
import type { Lang } from "@/translations/languages";

const RANKS: Record<string, [string, string]> = {
  PVT: ["Private", "PVT"],
  PVC: ["Private First Class", "PFC"],
  SPC: ["Specialist", "SPC"],
  SP5: ["Specialist 5", "SP5"],
  SP6: ["Specialist 6", "SP6"],
  SP7: ["Specialist 7", "SP7"],
  SP8: ["Specialist 8", "SP8"],
  SP9: ["Specialist 9", "SP9"],
  CPL: ["Corporal", "CPL"],
  SGT: ["Sergeant", "SGT"],
  SSG: ["Staff Sergeant", "SSG"],
  SFC: ["Sergeant First Class", "SFC"],
  MSG: ["Master Sergeant", "MSG"],
  "1SG": ["First Sergeant", "1SG"],
  SGM: ["Sergeant Major", "SGM"],
  CSM: ["Command Sergeant Major", "CSM"],
  SMA: ["Sergeant Major of the Army", "SMA"],
  WO1: ["Warrant Officer 1", "WO1"],
  CW2: ["Chief Warrant Officer 2", "CW2"],
  CW3: ["Chief Warrant Officer 3", "CW3"],
  CW4: ["Chief Warrant Officer 4", "CW4"],
  CW5: ["Chief Warrant Officer 5", "CW5"],
  "2LT": ["Second Lieutenant", "2LT"],
  "1LT": ["First Lieutenant", "1LT"],
  CPT: ["Captain", "CPT"],
  MAJ: ["Major", "MAJ"],
  LTC: ["Lieutenant Colonel", "LTC"],
  COL: ["Colonel", "COL"],
  BG: ["Brigadier General", "BG"],
  MG: ["Major General", "MG"],
  LTG: ["Lieutenant General", "LTG"],
  GEN: ["General", "GEN"],
  GOA: ["General of the Army", "GOA"],
};

const STARS: Record<string, number> = { BG: 1, MG: 2, LTG: 3, GEN: 4, GOA: 5 };
const ENLISTED_CHEVRONS: Record<string, [number, number]> = {
  // [chevrons up, rockers below]
  PVC: [1, 0], CPL: [2, 0], SGT: [3, 0], SSG: [3, 1], SFC: [3, 2], MSG: [3, 3],
  "1SG": [3, 3], SGM: [3, 3], CSM: [3, 3], SMA: [3, 3],
};

function key(name: string): string | undefined {
  const m = /^\{LANG_RANG_([A-Z0-9]+)\}$/.exec(name);
  return m?.[1];
}

// "{LANG_RANG_CW3}" -> "Chief Warrant Officer 3"; names set in the admin stay as they are.
export function rankName(name: string): string {
  const k = key(name);
  return k ? (RANKS[k]?.[0] ?? k) : name;
}

// Insignia for a rank: chevrons for enlisted, bars for warrant officers and
// lieutenants, stars for generals, a lettered disc for anything else.
// `plain` leaves out the <title> (the signature renderer would print it).
export function RankBadge({ name, size = 48, dim = false, plain = false }: { name: string; size?: number; dim?: boolean; plain?: boolean }) {
  const k = key(name) ?? "";
  const title = rankName(name);
  const gold = "#f2c200";
  let circleLabel = "";
  const shape = (() => {
    if (STARS[k]) {
      const n = STARS[k];
      const r = [0, 13, 10, 8, 6, 4.9][n];
      return Array.from({ length: n }, (_, i) => {
        const cx = 24 + (i - (n - 1) / 2) * (2 * r - 0.5);
        return <polygon key={i} points={star(cx, 24, r)} fill="#e8e8e8" stroke="#777" strokeWidth="0.5" />;
      });
    }
    if (/^(WO1|CW[2-5])$/.test(k)) {
      const n = k === "WO1" ? 1 : Number(k.slice(2)) - 1;
      return (
        <>
          <rect x="18" y="6" width="12" height="36" rx="2" fill="#cfcfcf" stroke="#666" />
          {Array.from({ length: n }, (_, i) => (
            <rect key={i} x="20" y={9 + i * (30 / n)} width="8" height={30 / n - 3} fill="#333" />
          ))}
        </>
      );
    }
    if (k === "2LT" || k === "1LT") return <rect x="18" y="6" width="12" height="36" rx="2" fill={k === "2LT" ? gold : "#d8d8d8"} stroke="#666" />;
    if (k === "CPT") return [0, 1].map((i) => <rect key={i} x={13 + i * 13} y="6" width="9" height="36" rx="2" fill="#d8d8d8" stroke="#666" />);
    if (k === "MAJ" || k === "LTC") return <polygon points={leaf()} fill={k === "MAJ" ? gold : "#d8d8d8"} stroke="#666" />;
    if (k === "COL")
      return plain ? (
        <path d="M24 14 L28 20 L42 14 L36 24 L30 26 L28 36 L24 32 L20 36 L18 26 L12 24 L6 14 L20 20 Z" fill="#d8d8d8" stroke="#666" />
      ) : (
        <text x="24" y="31" textAnchor="middle" fontSize="20" fill="#d8d8d8">🦅</text>
      );
    const ch = ENLISTED_CHEVRONS[k];
    if (ch) {
      return (
        <>
          {Array.from({ length: ch[0] }, (_, i) => (
            <polyline key={`c${i}`} points={`10,${20 + i * 6} 24,${10 + i * 6} 38,${20 + i * 6}`} fill="none" stroke={gold} strokeWidth="4" strokeLinejoin="round" />
          ))}
          {Array.from({ length: ch[1] }, (_, i) => (
            <path key={`r${i}`} d={`M10 ${32 + i * 5} Q24 ${40 + i * 5} 38 ${32 + i * 5}`} fill="none" stroke={gold} strokeWidth="3.5" />
          ))}
          {k === "1SG" ? <rect x="21" y="30" width="6" height="6" fill={gold} /> : null}
          {k === "SGM" || k === "CSM" || k === "SMA" ? <polygon points={star(24, 33, 4)} fill={gold} /> : null}
        </>
      );
    }
    if (k === "PVT") return <circle cx="24" cy="24" r="12" fill="none" stroke="#777" strokeWidth="2" />;
    const label = RANKS[k]?.[1] ?? (title.match(/\b\w/g) ?? []).join("").slice(0, 3).toUpperCase();
    circleLabel = label;
    return (
      <>
        <circle cx="24" cy="24" r="17" fill="#2a2a2a" stroke={gold} strokeWidth="2" />
        {plain ? null : (
          <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="bold" fill={gold}>
            {label}
          </text>
        )}
      </>
    );
  })();
  const svg = (
    <svg className={dim ? "rank-badge dim" : "rank-badge"} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title}>
      {plain ? null : <title>{title}</title>}
      {shape}
    </svg>
  );
  // The signature renderer (satori) draws no SVG <text>, so the plain badge
  // puts the label on top of the circle as a box instead.
  if (!plain || !circleLabel) return svg;
  return (
    <div style={{ display: "flex", position: "relative", width: size, height: size }}>
      {svg}
      <div style={{ display: "flex", position: "absolute", left: 0, top: 0, width: size, height: size, alignItems: "center", justifyContent: "center", fontSize: Math.round((size * 11) / 48), fontWeight: 700, color: gold }}>
        {circleLabel}
      </div>
    </div>
  );
}

function star(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(" ");
}

function leaf(): string {
  return "24,6 30,16 38,14 33,24 40,30 30,30 26,42 22,42 18,30 8,30 15,24 10,14 18,16";
}

// ---------------------------------------------------------------- ribbons

const CLASS_COLORS = ["#b0703a", "#a9b0b8", "#d9ae1e"];

function hue(code: string): number {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

// A service ribbon for an award: stripes in the award's own colour, edges in
// the class colour (bronze, silver, gold), and one pip per level.
export function Ribbon({
  code,
  title,
  label,
  ribbon,
}: {
  code: string;
  title: string;
  label?: string;
  ribbon: { index: number; level: number; max: number; name: string } | null;
}) {
  const h = hue(code);
  const edge = ribbon ? CLASS_COLORS[Math.min(ribbon.index, CLASS_COLORS.length - 1)] : "#444";
  const style = {
    "--ribbon-bg": `linear-gradient(90deg, ${edge} 0 12%, hsl(${h} 55% 38%) 12% 30%, #eee 30% 34%, hsl(${(h + 40) % 360} 60% 45%) 34% 66%, #eee 66% 70%, hsl(${h} 55% 38%) 70% 88%, ${edge} 88% 100%)`,
  } as CSSProperties;
  return (
    <span className={ribbon ? "ribbon" : "ribbon none"} style={style} title={title}>
      <span className="ribbon-label">{label ?? title}</span>
      {ribbon ? (
        <span className="pips" aria-hidden="true">
          {Array.from({ length: ribbon.level }, (_, i) => (
            <i key={i} style={{ background: edge }} />
          ))}
        </span>
      ) : null}
    </span>
  );
}

// Bronze, silver, gold in each language of src/translations.
const CLASS_NAMES: Record<string, Partial<Record<Lang, string>> & { en: string }> = {
  "{LANG_BRONZE}": { en: "Bronze", de: "Bronze", ru: "Бронза", es: "Bronce", fr: "Bronze", pt: "Bronze", nl: "Brons", da: "Bronze", pl: "Brąz", "pt-br": "Bronze", sr: "Бронза", "zh-tw": "銅", "zh-cn": "铜" },
  "{LANG_SILVER}": { en: "Silver", de: "Silber", ru: "Серебро", es: "Plata", fr: "Argent", pt: "Prata", nl: "Zilver", da: "Sølv", pl: "Srebro", "pt-br": "Prata", sr: "Сребро", "zh-tw": "銀", "zh-cn": "银" },
  "{LANG_GOLD}": { en: "Gold", de: "Gold", ru: "Золото", es: "Oro", fr: "Or", pt: "Ouro", nl: "Goud", da: "Guld", pl: "Złoto", "pt-br": "Ouro", sr: "Злато", "zh-tw": "金", "zh-cn": "金" },
};

export function ribbonClassName(name: string, lang: Lang): string {
  const n = CLASS_NAMES[name];
  return n ? (n[lang] ?? n.en) : name;
}

// Class and level of a ribbon as text with a small bar towards the next
// class, e.g. "Silber 3/8" and "5 more to Gold" on hover.
export function RibbonLevel({
  progress: p,
  className,
  texts,
}: {
  progress: { index: number; name: string; level: number; max: number; share: number; nextName: string | null; toNext: number | null } | null;
  className: (name: string) => string;
  texts: { toNext: string; maxed: string };
}) {
  if (!p) return null;
  const cls = Math.min(p.index, CLASS_COLORS.length - 1);
  const color = CLASS_COLORS[cls];
  const hint = p.nextName && p.toNext !== null ? texts.toNext.replace("{n}", String(p.toNext)).replace("{cls}", className(p.nextName)) : texts.maxed;
  return (
    <span className="ribbon-level" title={hint}>
      {/* Text in the template's readable shade of the class colour (--ribbon-text-1..3). */}
      <b style={{ color: `var(--ribbon-text-${cls + 1}, ${color})` }}>
        {className(p.name)} {p.level}/{p.max}
      </b>
      <span className="ribbon-level-bar" aria-hidden="true">
        <i style={{ width: `${Math.round(p.share * 100)}%`, background: color }} />
      </span>
    </span>
  );
}

import { basePath } from "@/lib/base-path";
import type { FlagCode } from "@/translations/languages";

// Flag of a language in the footer: the same flat SVG flags with a light
// gloss as the country flags of the players (public/flags).
export function LangFlag({ code, title }: { code: FlagCode; title: string }) {
  return <span className="flag-svg lang-flag" role="img" title={title} aria-label={title} style={{ backgroundImage: `url(${basePath}/flags/${code}.svg)` }} />;
}

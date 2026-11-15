import ar from "./ar";
import cs from "./cs";
import da from "./da";
import es from "./es";
import fr from "./fr";
import it from "./it";
import ja from "./ja";
import ko from "./ko";
import nl from "./nl";
import pl from "./pl";
import pt from "./pt";
import ptBr from "./pt-br";
import ru from "./ru";
import sr from "./sr";
import sv from "./sv";
import tr from "./tr";
import uk from "./uk";
import zhCn from "./zh-cn";
import zhTw from "./zh-tw";
import { PERM_TEXTS } from "./perms";
import type { Dialect, Lang } from "../languages";

// Admin texts of every language besides German and English (lib/admin-i18n.ts).
// Dialects use the texts of their base language.
// The type makes a new language in languages.ts fail the build until it has a file here.
const base: Record<Exclude<Lang, "de" | "en" | Dialect>, Record<string, string>> = { ru, es, fr, pt, nl, da, pl, "pt-br": ptBr, sr, "zh-tw": zhTw, "zh-cn": zhCn, ja, ko, ar, tr, it, uk, cs, sv };
// The texts of the admin rights live in perms.ts (one file for all languages).
export const ADMIN_TEXTS = Object.fromEntries(Object.entries(base).map(([l, t]) => [l, { ...t, ...PERM_TEXTS[l] }])) as typeof base;

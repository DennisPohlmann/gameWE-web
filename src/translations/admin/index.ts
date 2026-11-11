import da from "./da";
import es from "./es";
import fr from "./fr";
import nl from "./nl";
import pl from "./pl";
import pt from "./pt";
import ptBr from "./pt-br";
import ru from "./ru";
import sr from "./sr";
import zhCn from "./zh-cn";
import zhTw from "./zh-tw";
import type { Lang } from "../languages";

// Admin texts of every language besides German and English (lib/admin-i18n.ts).
// The type makes a new language in languages.ts fail the build until it has a file here.
export const ADMIN_TEXTS: Record<Exclude<Lang, "de" | "en">, Record<string, string>> = { ru, es, fr, pt, nl, da, pl, "pt-br": ptBr, sr, "zh-tw": zhTw, "zh-cn": zhCn };

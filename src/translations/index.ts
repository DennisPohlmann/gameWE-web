import ar from "./ar.json";
import bar from "./bar.json";
import cs from "./cs.json";
import da from "./da.json";
import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import gsw from "./gsw.json";
import it from "./it.json";
import ja from "./ja.json";
import ko from "./ko.json";
import nds from "./nds.json";
import nl from "./nl.json";
import pl from "./pl.json";
import ptBr from "./pt-br.json";
import pt from "./pt.json";
import ru from "./ru.json";
import sr from "./sr.json";
import sv from "./sv.json";
import swg from "./swg.json";
import tr from "./tr.json";
import uk from "./uk.json";
import zhCn from "./zh-cn.json";
import zhTw from "./zh-tw.json";
import { LANGUAGES, baseLang, type Lang } from "./languages";

// connectTypes is looked up by the number the collector writes.
export type Dict = Omit<typeof en, "connectTypes"> & { connectTypes: Record<number, string> };

// Partial files: a missing text (also inside a group such as evText) is
// taken from English.
type DeepPartial<T> = { [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]> };

function merge<T extends object>(base: T, over: DeepPartial<T>): T {
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over)) {
    const b = (base as Record<string, unknown>)[k];
    if (b === undefined) continue;
    out[k] = typeof b === "object" && b !== null && typeof v === "object" && v !== null ? merge(b, v) : typeof v === "string" ? v : b;
  }
  return out as T;
}

const files: Record<Lang, DeepPartial<typeof en>> = { en, de, bar, gsw, swg, nds, ru, es, fr, pt, nl, da, pl, "pt-br": ptBr, sr, "zh-tw": zhTw, "zh-cn": zhCn, ja, ko, ar, tr, it, uk, cs, sv };

// A dialect fills its gaps from its base language (German), the rest from English.
const full = (code: Lang): Dict => {
  const base = baseLang(code);
  return merge(base !== code ? full(base) : (en as unknown as Dict), files[code] as DeepPartial<Dict>);
};

export const dicts = Object.fromEntries(LANGUAGES.map((l) => [l.code, full(l.code)])) as Record<Lang, Dict>;

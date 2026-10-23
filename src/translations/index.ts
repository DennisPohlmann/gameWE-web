import da from "./da.json";
import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import nl from "./nl.json";
import pl from "./pl.json";
import ptBr from "./pt-br.json";
import pt from "./pt.json";
import ru from "./ru.json";
import sr from "./sr.json";
import zhCn from "./zh-cn.json";
import zhTw from "./zh-tw.json";
import type { Lang } from "./languages";

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

const files: Record<Lang, DeepPartial<typeof en>> = { en, de, ru, es, fr, pt, nl, da, pl, "pt-br": ptBr, sr, "zh-tw": zhTw, "zh-cn": zhCn };

export const dicts = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, merge(en, v)])) as unknown as Record<Lang, Dict>;

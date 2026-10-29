import { api } from "@/lib/api";
import { listTemplates } from "@/lib/templates";

// The styles of the banners besides the skin default: one per design
// template, as in the website's banner code box.
export function GET() {
  return api(async () => ({ data: (await listTemplates()).map((t) => ({ id: t.id, name: { en: t.name.en, de: t.name.de } })) }));
}

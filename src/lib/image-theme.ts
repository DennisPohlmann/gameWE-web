import "server-only";
import { getSettings } from "./settings";
import { gameTemplate, listTemplates, resolveTemplate, templateCss } from "./templates";
import { bannerTheme, chosenTemplate, type ImageTheme } from "./banner-theme";

export type { ImageTheme } from "./banner-theme";
export { parseImageFile } from "./banner-theme";

// Colours for the generated pictures (forum signature, server banner): the
// banner of a design template (src/lib/banner-theme.ts). Without a style, or
// with one that is no template (old "-classic" URLs included), the active
// skin of that ranking: its game design while "Game designs" is on, else the
// site's template.
export async function imageTheme(style: string | null, game: { realgame: string | null; code: string }): Promise<ImageTheme> {
  const id = chosenTemplate(style, (await listTemplates()).map((t) => t.id));
  const css = id ? await templateCss(id) : null;
  if (css) return bannerTheme(css);
  const { skin, gameSkins } = await getSettings();
  const t = (gameSkins ? await gameTemplate(game.realgame, game.code) : null) ?? (await resolveTemplate(skin));
  return bannerTheme(t ? await templateCss(t.id) : null);
}

// The styles to choose besides the skin default: every template.
export async function imageStyles(lang: "de" | "en"): Promise<{ id: string; name: string }[]> {
  return (await listTemplates()).map((t) => ({ id: t.id, name: t.name[lang] }));
}

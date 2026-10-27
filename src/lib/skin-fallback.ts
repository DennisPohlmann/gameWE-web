// Built-in templates that were removed (only dark, light, orange,
// modern-dark, modern-light and modern-orange ship now) and the kept one that
// takes over for each: a stored "Design (template)" setting or an old banner
// URL ("12-blue.png") naming one keeps a matching look. The classic colour
// variants and the dark game designs become "dark", the light TF2 design
// "light", the modern colour variants "modern-dark". Pure, so tests can run it.

export const REMOVED_TEMPLATES: Readonly<Record<string, string>> = {
  blue: "dark",
  green: "dark",
  pink: "dark",
  red: "dark",
  "game-csgo": "dark",
  "game-css": "dark",
  "game-cstrike": "dark",
  "game-dods": "dark",
  "game-hl2mp": "dark",
  "game-tf": "light",
  "modern-blue": "modern-dark",
  "modern-gold": "modern-dark",
  "modern-green": "modern-dark",
  "modern-pink": "modern-dark",
  "modern-red": "modern-dark",
};

// The template to use for `id`: itself while it exists (a folder of that name
// in /var/lib/gamewe/web/templates still wins), else the replacement of a removed
// built-in one if that exists, else `id` unchanged (resolveTemplate then falls back to
// "dark").
export function replacedTemplate(id: string, available: readonly string[]): string {
  if (available.includes(id)) return id;
  const to = Object.hasOwn(REMOVED_TEMPLATES, id) ? REMOVED_TEMPLATES[id] : undefined;
  return to && available.includes(to) ? to : id;
}

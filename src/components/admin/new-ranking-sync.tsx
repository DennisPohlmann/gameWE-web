"use client";

import { useEffect } from "react";

// The new-ranking form in the browser: once a game is chosen, the template
// list offers only the rankings of that game, and the name field shows the
// game's name it takes when left empty. Without JavaScript all templates stay
// listed; the save refuses one of another game (new-ranking.ts).
// templates: code -> base game of each template; names: game -> its name.
export function NewRankingSync({ templates, names }: { templates: Record<string, string>; names: Record<string, string> }) {
  useEffect(() => {
    const game = document.getElementById("f-realgame") as HTMLSelectElement | null;
    const tpl = document.getElementById("f-template") as HTMLSelectElement | null;
    const name = document.getElementById("f-name") as HTMLInputElement | null;
    if (!game || !tpl) return;
    const sync = () => {
      const g = game.value;
      for (const o of Array.from(tpl.options)) {
        if (!o.value) continue;
        const off = Boolean(g) && templates[o.value] !== g;
        o.hidden = off;
        o.disabled = off;
      }
      if (tpl.selectedOptions[0]?.disabled) tpl.value = "";
      if (name) name.placeholder = names[g] ?? "";
    };
    sync();
    game.addEventListener("change", sync);
    return () => game.removeEventListener("change", sync);
  }, [templates, names]);
  return null;
}

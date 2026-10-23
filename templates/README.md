# Design templates

Each folder here is one design. The site lists every folder it finds under
Admin > Settings > "Design (template)".

```
templates/
  orange/
    theme.css      # required: the CSS variables
    template.json  # optional: display name
```

## Your own template

1. Copy a folder that comes close, e.g. `orange` (it lists every variable),
   and give it a new name: lower-case letters, digits, `-` and `_`, at most
   32 characters (`clan-blue`, `dark2`).
2. Change the colours in `theme.css`. Keep the selector `html[data-skin]`;
   only CSS variables belong in it.
3. Optional `template.json`:

   ```json
   { "name": { "de": "Clan-Blau", "en": "Clan blue" } }
   ```

4. Put the folder where the site finds it:
   - **`TEMPLATES_DIR`** (recommended, survives updates): e.g.
     `TEMPLATES_DIR=/etc/gamewe/web/templates` in `web.env`, or in Docker a
     volume such as `-v ./my-templates:/app/custom-templates:ro` with
     `TEMPLATES_DIR=/app/custom-templates`.
   - or directly in this folder (`/opt/gamewe/web/templates`); an update
     replaces it.

   A folder in `TEMPLATES_DIR` with the same name as a built-in one replaces
   it. New folders show up within a minute.

Only plain folders and a plain `theme.css` (no symbolic links, at most 256 KB)
are used.

## Game designs

Folders named `game-<game>` (`game-css`, `game-cstrike`, `game-tf`,
`game-hl2mp`, `game-dods`, `game-csgo`) are game designs. With the
setting "Game designs" on (off by default), the pages of a ranking use the design of
its game (`hlstats_Games.realgame`, else the ranking code), the rest of the
site keeps the main template. A game design can also be chosen as the main
template.

## Signature and server banner

The forum signature (`/sig/…`) and the server banner (`/banner/…`) come in
the colours of every template, yours included, without extra work. They use
`--surface`, `--surface-2`, `--panel`, `--text`, `--muted`, `--accent`,
`--good`, `--bad`, `--border`, `--bar-bg` and `--bar-border`. Only plain
colours count (`#rgb`, `#rrggbb`, `rgb()`/`rgba()`, colour names); anything
else falls back to the classic colours.

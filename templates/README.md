# Design templates

Each folder here is one design. The site lists every folder it finds under
Admin > Settings > Design & logo > "Design (template)". The admin area has
its own design and is not part of a template.

Six designs are built in: `dark` (the default), `light`, `orange`,
`modern-dark`, `modern-light` and `modern-orange`. The others of earlier
versions are gone; a setting, banner URL (`12-blue.png`) or picker that still
names one gets its replacement: `blue`, `green`, `pink`, `red` and the game
designs `game-csgo`, `game-css`, `game-cstrike`, `game-dods`, `game-hl2mp`
become `dark`, `game-tf` becomes `light`, `modern-blue`, `modern-gold`,
`modern-green`, `modern-pink` and `modern-red` become `modern-dark`
(`src/lib/skin-fallback.ts`). An own template in `TEMPLATES_DIR` with one of
these names is used as it is. Saving Admin > Settings > Design & logo writes
the replacement to the database.

```
templates/
  orange/
    theme.css      # required: the CSS variables
    template.json  # optional: display name
    chart.json     # optional: chart colours, see "Charts" below
```

## Your own template

1. Copy a folder that comes close, e.g. `orange` (it lists every variable),
   and give it a new name: lower-case letters, digits, `-` and `_`, at most
   32 characters (`clan-blue`, `dark2`).
2. Change the colours in `theme.css`. Keep the selector `html[data-skin]`;
   only CSS variables belong in it. Keep text readable (contrast at least
   4.5:1): `--accent-text` is the accent as text on `--surface`, `--th-bg`
   and `--panel` (active tabs and menu entries); `--accent-on` is the text
   on an `--accent` background (black by default, white for a dark accent);
   `--tab-text` must stay readable on both colours of `--tab-bg` and
   `--tab-hover`; `--ribbon-text-1` to `-3` are the bronze, silver and gold
   ribbon class names on `--surface`.
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

## Charts (`chart.json`)

All graphs (line and bar charts, server load, pies, the summary's trend
graphics, the kill heatmap and the hover boxes) take their colours from
`--chart-*` variables. Without a `chart.json`, or for a key it leaves out,
they follow the template's `theme.css` (background `--surface`, grid
`--grid`, labels `--muted` and `--text`, first series `--accent`, second
`--series-2`, gains `--good`, losses `--bad`, ...), so every template gets
matching charts without extra work. A `chart.json` next to `theme.css` sets
them yourself; every key is optional:

| Key | Colours | Default |
| --- | --- | --- |
| `background` | chart area | `--surface` |
| `border` | frame around the chart | `--border` |
| `grid` | grid lines | `--grid` |
| `axis` | axis labels, band labels | `--muted` |
| `axisStrong` | dates under the day boundaries | `--text` |
| `dayLine` | dashed day boundaries of hourly charts | `--grid-2` |
| `guide` | dashed line under the pointer | `--muted` |
| `title` | chart title above the chart | `--text` |
| `legend` | legend text | `--muted` |
| `dotEdge` | edge of the points on lines | `--surface` |
| `pieEdge` | edge between pie slices | `--surface` |
| `barHover` | band behind the day under the pointer | `--text` at 8 % |
| `band`, `bandOdd` | day bands of the server load chart | `--band`, `--band-odd` |
| `uptime` | uptime line of the server load chart | `#6fbf73` |
| `gain`, `loss` | rising and falling bars (points, trends) | `--good`, `--bad` |
| `tooltip.background`, `.text`, `.border`, `.title` | hover box | `--surface` at 94 %, `--text`, `--border`, `--accent-text` |
| `spark.total`, `.current`, `.totalLine`, `.currentLine`, `.text`, `.frame`, `.edge`, `.line` | trend graphics of the profile summary | grey/blue pills, `--band`, `--grid-2`, `--soft` |
| `radar.total`, `.current`, `.grid`, `.label` | radar of the profile summary (polygons, points, tooltip swatches; the average is drawn dashed with hollow points, the player solid and filled) | `#8ca0ff`, `--accent`, `--grid-2`, `--soft` |
| `heatmapBackground`, `heatmapKill`, `heatmapDeath`, `heatmapEdge` | map heatmap background, kill and death dots, centre of the headshot dots | `#0d1117`, `#33aaff`, `#e03030`, `#ffffff` |
| `series` | up to 8 colours of the data lines and bars | `--accent`, `--series-2`, `--series-3`, then a fixed palette |
| `servers` | up to 8 colours, one per server in the graph of all servers | fixed palette |
| `pie` | up to 9 colours of the pie slices | `--accent`, then a fixed palette |

Allowed values: `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()` and
`hsl()`/`hsla()` with plain numbers (`%` and `deg` allowed), CSS colour names
and `transparent`. Anything else (`var()`, `url()`, gradients, several
values, `;` or braces) is ignored and the default applies; the server log
names the ignored keys (not the values). An entry of `series`, `servers` or
`pie` that is not valid keeps the default of that position; entries beyond
the limit are ignored. The file must be a plain file (no symbolic link) of
at most 16 KB with valid JSON, else all defaults apply. A changed
`chart.json` shows up like a changed `theme.css` (within a minute).

Colours shown together in one chart never repeat: the total line and the
server lines (`series[0]` and `servers`), the series among themselves,
players and uptime (`series[1]`, `uptime`), points, gains and losses
(`series[0]`, `gain`, `loss`), the trend pills (`spark.total`,
`spark.current`, `gain`, `loss`), their reference lines, the two radar
areas and the pie slices. The site compares the resolved colours (from
`chart.json`, else from `theme.css`; `#f00`, `#ff0000`, `red` and
`rgb(255, 0, 0)` count as the same) and replaces a colour that repeats an
earlier one of the same chart with an unused one from a built-in palette;
the server log names the replaced keys. These chart colours are written
into the stylesheet as plain colours.

Example (light charts on a dark template):

```json
{
  "background": "#ffffff",
  "grid": "#e2e2e2",
  "axis": "#555555",
  "axisStrong": "#333333",
  "dayLine": "#9a9a9a",
  "dotEdge": "#ffffff",
  "tooltip": { "background": "rgba(20, 20, 20, 0.92)", "text": "#ffffff" },
  "series": ["#ff8000", "#5aa9ff", "#d64541"],
  "servers": ["#2f7dc0", "#2e9e2e", "#c03030"]
}
```

The built-in templates each come with a `chart.json`; `orange/chart.json`
lists every key.

## Modern templates

The `modern-*` templates (`modern-orange`, `modern-dark`, `modern-light`)
change the layout as well as the colours: header with big accent-coloured
links, the ranking's sections as a full-width bar under the header, one
narrow centred column, rounded cards with a title strip, flat tables and
filled areas under the chart lines. Unlike the other templates their
`theme.css` carries layout rules after the variables, all scoped to
`html[data-skin]` so they only apply while the template is loaded (and are
rescoped like the variables when one is used as a game design).

They share one layout and differ only in colours; their files are generated:

- `scripts/modern-templates/layout.css`: the layout rules, written against
  the usual variables and the `--m-*` variables of the family (`--m-bar`,
  `--m-head`, `--m-zebra`, `--m-on-accent` for text on the accent colour, ...).
- `scripts/modern-templates.mjs`: the colours of each variant (a dark and a
  light base, the accent per variant), the chart colours and display names.

After changing either, run `npm run templates` and commit the generated
folders; `npm test` fails while they are out of date. A copy of a
`modern-*` folder under another name is an ordinary template and can be
edited directly.

### Filled chart areas

Line charts draw an (invisible) area under each line, so a template can fill
it without code changes:

| Selector | Area |
| --- | --- |
| `.chart .area.s1` … `.chart .area.s8` | under the lines of the line charts (series 1 to 8) |
| `.load-chart .area-players` | under the players line of the server load chart |

By default they have `fill: none`. The modern templates fill them, e.g.

```css
html[data-skin] .chart .area.s1 { fill: color-mix(in srgb, var(--chart-series-1) 24%, transparent); }
html[data-skin] .load-chart .area-players { fill: color-mix(in srgb, var(--chart-series-1) 24%, transparent); }
```

### General statistics line

The cards of the start page's "General statistics" draw a faint line of the
last 30 days behind their text in `--stat-line`, by default the template's
`--good` (green). Set `--stat-line` in `theme.css` for another colour; keep it
calm, the text lies on top of it.

## Game designs

Folders named `game-<game>` (e.g. `game-css`, `game-cstrike`, `game-tf`) are
game designs. None is built in; put your own in `TEMPLATES_DIR`. With the
setting "Game designs" on (off by default), the pages of a ranking use the design of
its game (`hlstats_Games.realgame`, else the ranking code), the rest of the
site keeps the main template. A game design can also be chosen as the main
template.

## Signature and server banner

The player banner or forum signature (`/banner/<game>/player/…`) and the
server banner (`/banner/<game>/server/…`) show the banner of the active
skin by default (the ranking's game design while "Game designs" is on, else
the main template); `…/<id>-<template>.png` picks another template.

A template defines its banner with `--banner-*` variables in its
`theme.css`, in an extra `html[data-skin] { … }` block at the end (see any
built-in template):

| Variable | Used for |
| --- | --- |
| `--banner-bg` | background of the picture |
| `--banner-side` | left side panel (rank insignia, player graph) |
| `--banner-side-text` | text on the side panel |
| `--banner-frame` | frame around the picture |
| `--banner-stripe` | stripe on top (`none`: no stripe) |
| `--banner-text` | values, names |
| `--banner-muted` | small text (site address) |
| `--banner-accent` | labels, graph line, the "WE" of the logo |
| `--banner-good`, `--banner-bad` | online / offline, gains / losses |
| `--banner-border` | lines |
| `--banner-bar-bg`, `--banner-bar-border` | progress bars, graph and pie background |

Only plain colours count (`#rgb`, `#rrggbb`, `rgb()`/`rgba()`, colour
names); `--banner-bg` and `--banner-side` may also be up to three
`linear-gradient(…)` of such colours (optional angle in `deg`, positions in
`%`). A template without banner definition gets the banner of `dark`, and
every variable it leaves out or sets to something else comes from there.

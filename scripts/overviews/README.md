# Radar pictures from the map files

`radar.ts` draws the top-down radar picture of a Source map (BSP version
19-21: CS:S, DoD:S, HL2DM, TF2, ...) and writes its calibration for
`overviews/` (see [overviews/README.md](../../overviews/README.md)). The
built-in pictures of `overviews/css/`, `dods/`, `fof/`, `hl2mp/`,
`nmrih/`, `tf/` and `zps/` are made with it from the stock
maps of the games' dedicated servers.

How it works: the floors are the upward faces of the map (displacements
included); the walkable areas of the map's navigation mesh (`<map>.nav`)
decide which of them count, so roofs, the skybox and the space outside the
map stay out. The picture is shaded by height (lighter is higher) with a
white outline. As the picture is drawn in game coordinates, the calibration
is exact.

```
npm run radar -- <map>.bsp <map>.nav <map>.png <map>.json [<lower split>]
```

It needs no Python, only the packages of `npm ci`.

- Without a navigation mesh pass `-` instead of the `.nav`; then the
  walkable floor is worked out from the spawn points: floor points with room
  for a player that can be reached on foot (steps and jumps up to 44 units,
  drops up to 400), leaving out water, slime, hurting areas (`trigger_hurt`)
  and solid wall entities (`func_brush`, `func_wall`). Rarely walked spots
  behind ladders or lifts may be missing, and a few maps get an area too
  many; the calibration stays exact. A `.nav` that cannot be read (e.g.
  NMRiH's newer format) is handled the same way.
- `npm run radar:all -- <bsp folder> <out folder> [workers]` draws every `<game>/<map>.bsp`
  below the first folder (with `<map>.nav` next to it, if there is one) into
  `<out folder>/<game>/`, several at a time; pictures that exist are kept
  (`css` is left out: its `.nav` files have to be extracted first).
- A fifth argument (a height, e.g. `-495` for de_nuke) also writes
  `<map>_lower.png` with only what lies below it, and `lower_split` into the
  calibration.
- CS:S keeps its `.nav` files inside `cstrike/cstrike_pak_dir.vpk`
  (`maps/<map>.nav`); extract them with any VPK tool.
- Map files are game data: only feed it maps you trust (the script reads
  them, it runs nothing from them).

## Redrawing another radar picture

`restyle.py` reads no map files and is still Python:

```
pip install numpy pillow scipy
python3 -I scripts/overviews/restyle.py <radar>.png|jpg <map>.png [<threshold>]
```

draws the playable area of a radar picture in the same style (grid,
letters, textures and colours of the source are dropped); the calibration
stays that of the source picture. The built-in pictures of
`overviews/cs2/` and `overviews/csgo/` are made with it (threshold 20 for
pictures with a dark floor, 45 for the CS:GO pictures).

## FastDL

`fastdl.ts` fetches one map and draws it, for the site's own switch; see
"Fetching maps by FastDL" in [overviews/README.md](../../overviews/README.md).
`npm run build` compiles it to `build/`, which ships with the site. There is no
`.nav` on FastDL, so these pictures take the walkable floor from the spawn points.

## Map thumbnails for the banners

`thumbs.ts` takes the menu pictures of the maps out of a Source game
(`materials/vgui/maps/menu_thumb_<map>.vtf`, from the `*_dir.vpk` archives
and loose files) and writes them as PNG to the website's map-images folder
(`<out>/<game>/<map>.png`, default `/var/lib/gamewe/web/map-images`, see
[INSTALLATION.md](../../docs/INSTALLATION.md#5-own-templates-and-map-pictures)).
It reads DXT1/3/5 and the plain RGB(A) formats, cuts the empty rows at the
bottom (CS:S keeps its 128x96 pictures in 128x128 textures) and keeps
pictures that are already there. The pictures belong to the game's maker;
gameWE comes with those of CS:S (`map-images/css/`, see its `LICENSE.txt`),
for other games each operator makes them from their own installation.

```
npm run map-thumbs -- "<game folder, e.g. .../Counter-Strike Source/cstrike>" <game code, e.g. css> [<out folder>]
```

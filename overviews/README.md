# Map overviews (radar pictures) for the heatmap

The heatmap of a map (`/<game>/maps/<id>`) draws its kill and death dots on
the map's overview picture when there is one, so you can see where on the
map they are. The site reads two folders, like the design templates:

- `overviews/` next to the server (this folder): built in, all in one style
  (height-shaded floor, white outline):
  - `cs2/`: de_ancient, de_anubis, de_cache, de_dust2, de_inferno,
    de_mirage, de_nuke, de_overpass, de_train, de_vertigo, redrawn from the
    radar pictures of [Boltobserv](https://github.com/boltgolt/boltobserv)
    (GPL-3.0, made with simpleradar; license text in
    `cs2/LICENSE-boltobserv.txt`), with Boltobserv's calibration; and the
    calibration of cs_italy, cs_office and de_dust from the game's own
    overview files (no picture);
  - `csgo/`: de_cache, de_canals, de_cbble, de_dust2, de_inferno, de_mirage,
    de_nuke (with the lower level), de_overpass, de_train, redrawn from the
    game's radar pictures, with the game's calibration;
  - `css/`: the 18 stock maps of Counter-Strike: Source (de_nuke with the
    lower level), drawn from the map files themselves by
    `scripts/overviews/radar.py`;
  - `tf/` (Team Fortress 2, 228 maps), `dods/` (Day of Defeat: Source, 9),
    `hl2mp/` (Half-Life 2 Deathmatch, 7), `insurgency/` (48), `nmrih/`
    (No More Room in Hell, 34), `fof/` (Fistful of Frags, 34) and `zps/`
    (Zombie Panic! Source, 27): the stock maps of the games' dedicated
    servers, drawn the same way (test, training and background maps left
    out).
- `OVERVIEWS_DIR` (environment, e.g. `/etc/gamewe/web/overviews`): your own
  folder, read in addition. A file with the same name as a built-in one wins.

New or changed files show up within a minute, without a restart.

## Layout

```
overviews/
  cs2/                   # one folder per game: the game code or the base game
    de_dust2.png         # the picture
    de_dust2.json        # its calibration (or Valve's de_dust2.txt)
    de_nuke.png
    de_nuke_lower.png    # optional: the lower level (?lv=lower)
  de_mymap.png           # directly in the folder: for every game
  de_mymap.txt
```

For a map the site looks in the folder of the game code (e.g. `cs2comp`), then
in the folder of the base game (`cs2`), then directly in the folder. Picture
and calibration are looked up separately: a `de_dust2.png` of your own in
`OVERVIEWS_DIR/cs2/` uses the built-in `cs2/de_dust2.json`. A picture from
the game itself is framed differently from the built-in `cs2` and `css`
pictures: copy the game's `<map>.txt` next to it, then its calibration is
used too.

Names are in lower case, as the map name (`de_dust2`); folders and files
must be plain files, not symbolic links.

- Picture: `<map>.png`, `<map>.webp` or `<map>.jpg` (also Valve's names
  `<map>_radar.png` and `<map>_radar_psd.png`), at most 8 MB. The lower
  level of a two-level map: `<map>_lower.png` (or `<map>_lower_radar.png`).
  Without it the lower level uses the main picture.
- Calibration: `<map>.json` or Valve's HLTV overview file `<map>.txt`.

## Calibration

The dots are in game units; the calibration says where the picture lies:

```json
{ "pos_x": -2476, "pos_y": 3239, "scale": 4.4 }
```

- `pos_x`, `pos_y`: the game coordinates of the picture's upper left corner.
- `scale`: game units per pixel of a picture 1024 pixels wide (Valve's radar
  pictures). A larger or smaller export of the same picture covers the same
  area, so the value stays the same. Set `ref` to another width if your
  scale refers to one (e.g. `"ref": 2048`).
- `lower_split` (optional): the height (`pos_z`) where the lower level ends;
  then the heatmap offers "upper level" and "lower level".
- `lower_offset` (optional, `{"x": 0, "y": -46}`): where a picture that
  shows both levels draws the lower one, in percent of the picture (as
  Boltobserv's map splits; y -46 = 46% further down). Without a
  `<map>_lower` picture the lower level then uses that part of the picture.

Valve's `resource/overviews/<map>.txt` (CS:GO, CS2, and the files of
community maps) has the same values (`pos_x`, `pos_y`, `scale`, the lower
level in `verticalsections`) and can be copied as it is. Older Source games
(CS:S) use `zoom` instead of `scale`; for them write a `.json` with values
you measured (see "Checking" below).

## Getting the pictures

For a Source map (also community maps) `scripts/overviews/radar.py` draws
the picture and its calibration from the map file, see
[scripts/overviews/README.md](../scripts/overviews/README.md);
`scripts/overviews/restyle.py` redraws another radar picture in the same
style. The games' own radar pictures:

- **Counter-Strike 2:** the pictures are in `game/csgo/pak01_dir.vpk` under
  `panorama/images/overheadmaps/` (`de_dust2_radar_psd.vtex_c`, ...). Open
  the VPK with Source 2 Viewer, export the picture as PNG and save it as
  `cs2/de_dust2.png` (or keep the name `de_dust2_radar_psd.png`).
- **CS:GO:** `csgo/resource/overviews/<map>_radar.dds`; convert it to PNG,
  e.g. `magick de_dust2_radar.dds de_dust2.png`, and copy `<map>.txt` from
  the same folder.
- **Community maps:** most come with `resource/overviews/<map>.txt` and a
  radar picture; convert and copy both.

## Checking

Open the map's page. When most of the dots lie outside the picture, the
calibration belongs to another version of the map: the heatmap is shown
without the picture and the server log says
`overview <map>: most positions lie outside the picture`. A picture or
calibration that cannot be read is noted in the log too.

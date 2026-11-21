# Map thumbnails for the banners

Built-in thumbnails for the map box of the upright side strip banner
(`src/lib/map-images.ts`): `<game>/<map>.webp`. Your own pictures in
`/var/lib/gamewe/web/map-images/<game>/<map>.png` (or `.webp`, `.jpg`) come
first; without either the banner shows a "no map image" box, never the
radar picture of the heatmap.

- `css/`: the 18 stock maps of Counter-Strike: Source, the game's own menu
  pictures, property of Valve Corporation; see `css/LICENSE.txt`.
- `dods/`: the 9 stock maps of Day of Defeat: Source, the same kind of
  pictures, property of Valve Corporation; see `dods/LICENSE.txt`.
- `hl2mp/`: the 7 stock maps of Half-Life 2 Deathmatch, the same kind of
  pictures, property of Valve Corporation; see `hl2mp/LICENSE.txt`.
- `l4d/`: the 26 campaign maps of Left 4 Dead, the game's own map
  pictures, property of Valve Corporation; see `l4d/LICENSE.txt`.
- `l4d2/`: the 49 campaign maps of Left 4 Dead 2 that have a picture
  of their own, property of Valve Corporation; see `l4d2/LICENSE.txt`.
- `csgo/`: the 37 maps of Counter-Strike: Global Offensive, the game's own
  map screenshots, property of Valve Corporation; see
  `csgo/LICENSE.txt`.
- `cs2/`: the 22 maps of Counter-Strike 2, the game's own map screenshots,
  property of Valve Corporation; see `cs2/LICENSE.txt`.
- `zps/`: 24 maps of Zombie Panic! Source, the game's own menu pictures,
  property of the Zombie Panic! Team; see `zps/LICENSE.txt`.

Made with `npm run map-thumbs` from a game installation
([scripts/overviews/README.md](../scripts/overviews/README.md)).

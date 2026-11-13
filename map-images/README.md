# Map thumbnails for the banners

Built-in thumbnails for the map box of the upright side strip banner
(`src/lib/map-images.ts`): `<game>/<map>.png`. Your own pictures in
`/var/lib/gamewe/web/map-images/<game>/<map>.png` (or `.webp`, `.jpg`) come
first; without either the banner shows a "no map image" box, never the
radar picture of the heatmap.

- `css/`: the 18 stock maps of Counter-Strike: Source, the game's own menu
  pictures, property of Valve Corporation; see `css/LICENSE.txt`.

Made with `npm run map-thumbs` from a game installation
([scripts/overviews/README.md](../scripts/overviews/README.md)).

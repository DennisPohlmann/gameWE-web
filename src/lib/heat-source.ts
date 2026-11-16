// Which positions a heatmap takes (heatmap.ts): hlstats_Events_Frags has the
// headshot flag, hlstats_Events_Locations has none. The collector writes a
// location for every kill line and plugin location line, so Locations always
// has a few more rows than the frags (team kills, suicides, kills whose frag
// missed its position) and would win any plain "more rows" contest, which
// took the headshot dots off every map played with the collector. The frags
// win unless they have fewer than half of the dots the locations could show
// (older CS:S kills with locations only).
export function fragsWin(frags: number, locations: number, dots: number): boolean {
  return frags > 0 && frags * 2 >= Math.min(locations, dots);
}

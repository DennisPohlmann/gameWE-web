// data-tip text for HoverTip, also usable in server components. A row of the
// hover box: colour swatch (class names after "swatch", or a CSS colour),
// name and value, like the rows of the line charts' box.
export type TipRow = { swatch: string; label: string; value: string };

// The head line, then one line per row (fields split at "\t"). Tabs and line
// breaks in the texts (map and player names come from game server logs)
// become spaces, so they cannot make up rows.
export function tipText(head: string, rows: TipRow[]) {
  const flat = (s: string) => s.replace(/[\t\r\n]+/g, " ");
  return [flat(head), ...rows.map((r) => `${flat(r.swatch)}\t${flat(r.label)}\t${flat(r.value)}`)].join("\n");
}

import type { ImageTheme } from "@/lib/image-theme";
import { backgroundLayer, type Background } from "./options";

// The background pattern of a banner, the first child of its frame (which
// needs position: relative): later children paint over it.
export function Backdrop({ bg, th }: { bg: Background; th: ImageTheme }) {
  const s = backgroundLayer(bg, th.text, th.accent);
  return s ? <div style={{ display: "flex", position: "absolute", left: 0, top: 0, right: 0, bottom: 0, ...s }} /> : null;
}

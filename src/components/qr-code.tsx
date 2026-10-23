import "server-only";
import { encode } from "uqr";

// QR code as an inline SVG (one path, dark modules on white), drawn on the server.
export function QrCode({ text, label, size = 220 }: { text: string; label: string; size?: number }) {
  const qr = encode(text, { ecc: "M", border: 4 });
  let d = "";
  qr.data.forEach((row, y) => row.forEach((on, x) => (d += on ? `M${x} ${y}h1v1h-1z` : "")));
  return (
    <svg className="qr" role="img" aria-label={label} width={size} height={size} viewBox={`0 0 ${qr.size} ${qr.size}`} shapeRendering="crispEdges">
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

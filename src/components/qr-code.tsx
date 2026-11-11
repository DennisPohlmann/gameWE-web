import "server-only";
import { encode } from "uqr";

// QR code modules as one SVG path (dark modules), drawn on the server; the
// page draws it on white (TotpSetup).
export function qrData(text: string): { size: number; d: string } {
  const qr = encode(text, { ecc: "M", border: 4 });
  let d = "";
  qr.data.forEach((row, y) => row.forEach((on, x) => (d += on ? `M${x} ${y}h1v1h-1z` : "")));
  return { size: qr.size, d };
}

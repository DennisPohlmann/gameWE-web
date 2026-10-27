import { overviewImage } from "@/lib/overviews";

// /overview/<dir>/<map>[.lower]: a map's overview picture from the overview
// folders (src/lib/overviews.ts), for the heatmap. With ?v=<file time> in the
// URL (the map page adds it) the browser may keep it for a year: a changed
// picture gets a new URL.
export async function GET(req: Request, { params }: { params: Promise<{ dir: string; file: string }> }) {
  const { dir, file } = await params;
  const img = await overviewImage(dir, file);
  if (!img) return new Response("not found", { status: 404 });
  return new Response(img.body as BodyInit, {
    headers: {
      "content-type": img.type,
      "cache-control": new URL(req.url).searchParams.has("v") ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
    },
  });
}

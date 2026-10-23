import { templateCss } from "@/lib/templates";

// /theme/<id>.css: the stylesheet of a template from the templates folder.
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  // <id>.css: site template; <id>.game.css: game design (see templateCss)
  const m = /^([a-z0-9][a-z0-9_-]{0,31})(\.game)?\.css$/.exec((await params).file);
  const css = m ? await templateCss(m[1], !!m[2]) : null;
  if (css === null) return new Response("not found", { status: 404 });
  return new Response(css, {
    headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=300", "x-content-type-options": "nosniff" },
  });
}

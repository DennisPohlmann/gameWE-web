import { notFound } from "next/navigation";

// Any other address below a game: the site's own 404 page (not-found.tsx of
// app/(site)). There is no root layout above the two route groups, so
// unmatched addresses would otherwise get the bare built-in page.
export default function NotFoundRest() {
  notFound();
}

import { Skeleton } from "@/components/ui";

// Shown at once when a ranking's section link is clicked (they prefetch this
// state), while the page renders on the server; the section list stays.
export default function Loading() {
  // In a section: as wide as the boxes above it, not the whole page; about a
  // screen high, like most lists, so the footer does not jump up and back.
  return (
    <div className="section">
      <Skeleton rows={30} />
    </div>
  );
}

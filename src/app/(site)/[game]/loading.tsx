import { Skeleton } from "@/components/ui";

// Shown at once when a ranking's section link is clicked (they prefetch this
// state), while the page renders on the server; the section list stays.
export default function Loading() {
  return <Skeleton rows={12} />;
}

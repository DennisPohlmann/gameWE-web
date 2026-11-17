import { Skeleton } from "@/components/ui";

// Shown while a page outside a ranking renders on the server (start page,
// search, help); the header and footer stay.
export default function Loading() {
  // In a section: as wide as the boxes above it, not the whole page; about a
  // screen high, like most lists, so the footer does not jump up and back.
  return (
    <div className="section">
      <Skeleton rows={30} />
    </div>
  );
}

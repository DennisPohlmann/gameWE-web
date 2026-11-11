import { Skeleton } from "@/components/ui";

// Shown while a page outside a ranking renders on the server (start page,
// search, help); the header and footer stay.
export default function Loading() {
  return <Skeleton rows={12} />;
}

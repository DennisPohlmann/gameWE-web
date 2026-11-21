import { SkeletonTable } from "@/components/ui";

// Shown while a page outside a ranking renders on the server (start page,
// search, help); the header and footer stay. Shaped like the start page's
// list: a block heading and a table, about a screen high, so the footer
// does not jump up and back.
export default function Loading() {
  return (
    <section className="block">
      <h3>&nbsp;</h3>
      <div className="container">
        <SkeletonTable rows={20} cols={4} />
      </div>
    </section>
  );
}

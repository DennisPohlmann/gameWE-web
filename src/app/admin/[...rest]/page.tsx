import { notFound } from "next/navigation";

// Any other address below /admin: the admin's own 404 page.
export default function AdminNotFoundRest() {
  notFound();
}

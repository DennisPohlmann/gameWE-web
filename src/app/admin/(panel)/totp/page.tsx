import { redirect } from "next/navigation";

// Moved to Mein Konto (/admin/account).
export default function TotpPage() {
  redirect("/admin/account");
}

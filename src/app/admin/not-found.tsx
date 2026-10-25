import Link from "next/link";
import { Logo } from "@/components/admin/nav";
import { adminDict } from "@/lib/admin-i18n";
import { getAdminLang } from "@/lib/i18n";

export default async function AdminNotFound() {
  const a = adminDict(await getAdminLang());
  return (
    <div className="adm-login">
      <div className="login">
        <span className="adm-brand">
          <Logo />
          <span>
            game<b>WE</b>
          </span>
          <small>Admin</small>
        </span>
        <h1>404</h1>
        <p>
          <Link href="/admin">← {a.ui.areaHome}</Link>
        </p>
      </div>
    </div>
  );
}

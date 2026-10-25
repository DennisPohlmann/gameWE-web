import Link from "next/link";
import { getDict } from "@/lib/i18n";

export default async function NotFound() {
  const { t } = await getDict();
  return (
    <div className="notice">
      <p>{t.notFound}</p>
      <p>
        <Link href="/">{t.backHome}</Link>
      </p>
    </div>
  );
}

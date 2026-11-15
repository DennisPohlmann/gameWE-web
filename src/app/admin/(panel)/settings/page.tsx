import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { allowed } from "@/lib/admin-perms";
import { settingGroups } from "@/lib/admin-settings";

// The settings are split into pages (/admin/settings/<group>); the first
// one is the start. Without settings.view the area holds only My account.
export default async function SettingsStart() {
  const user = await requireAdmin();
  redirect(allowed(user, "settings.view") ? `/admin/settings/${settingGroups[0].id}` : "/admin/account");
}

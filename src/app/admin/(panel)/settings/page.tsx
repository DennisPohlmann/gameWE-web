import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { settingGroups } from "@/lib/admin-settings";

// The settings are split into pages (/admin/settings/<group>); the first
// one is the start.
export default async function SettingsStart() {
  await requireAdmin();
  redirect(`/admin/settings/${settingGroups[0].id}`);
}

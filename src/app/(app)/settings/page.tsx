import { createClient } from "@/lib/supabase/server";
import SettingsShell from "./SettingsShell";
import { resolveAccountOwnerId } from "@/lib/account-owner";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);

  const [profileRes, companyRes, prefsRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", user!.id).single(),
    supabase.from("companies").select("*").eq("user_id", ownerId).single(),
    supabase.from("user_preferences").select("*").eq("user_id", ownerId).single(),
  ]);

  return (
    <SettingsShell
      userId={user!.id}
      accountOwnerId={ownerId}
      userEmail={user!.email ?? ""}
      companyId={companyRes.data?.id ?? null}
      profile={profileRes.data ?? {}}
      company={companyRes.data ?? {}}
      prefs={prefsRes.data ?? {}}
    />
  );
}

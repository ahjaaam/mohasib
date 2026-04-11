import { createClient } from "@/lib/supabase/server";
import SettingsShell from "./SettingsShell";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [profileRes, companyRes, prefsRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", user!.id).single(),
    supabase.from("companies").select("*").eq("user_id", user!.id).single(),
    supabase.from("user_preferences").select("*").eq("user_id", user!.id).single(),
  ]);

  return (
    <SettingsShell
      userId={user!.id}
      userEmail={user!.email ?? ""}
      profile={profileRes.data ?? {}}
      company={companyRes.data ?? {}}
      prefs={prefsRes.data ?? {}}
    />
  );
}

export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import SettingsClient from "./SettingsClient";
import type { Cabinet } from "@/types/fiduciaire";

export default async function FiduciaireSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [profileRes, cabinetRes] = await Promise.all([
    supabase.from("users").select("full_name, company").eq("id", user!.id).single(),
    supabase.from("cabinets").select("*").eq("user_id", user!.id).single(),
  ]);

  return (
    <SettingsClient
      userId={user!.id}
      profile={profileRes.data}
      cabinet={cabinetRes.data as Cabinet | null}
    />
  );
}

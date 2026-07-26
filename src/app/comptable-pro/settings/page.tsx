export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";
import type { Cabinet } from "@/types/fiduciaire";
import { resolveClientPortalRedirect } from "@/lib/team";

export default async function FiduciaireSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const clientRedirect = await resolveClientPortalRedirect(user.id);
  if (clientRedirect) redirect(clientRedirect);

  const [profileRes, cabinetRes] = await Promise.all([
    supabase.from("users").select("full_name, company").eq("id", user.id).single(),
    supabase.from("cabinets").select("*").eq("user_id", user.id).single(),
  ]);

  return (
    <SettingsClient
      userId={user.id}
      profile={profileRes.data}
      cabinet={cabinetRes.data as Cabinet | null}
    />
  );
}

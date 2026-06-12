import FiduciaireShell from "@/components/FiduciaireShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserAccessProfile, resolveTeamContext } from "@/lib/team";
import { getPlanEntitlements } from "@/lib/plan-entitlements";

export default async function FiduciaireLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");
  const teamContext = await resolveTeamContext(user.id);
  if (teamContext?.track !== "comptable") redirect("/tableau-de-bord");

  const [profileRes, cabinetRes, access, entitlements] = await Promise.all([
    supabase.from("users").select("full_name, company").eq("id", user.id).single(),
    supabase.from("cabinets").select("nom_cabinet").eq("user_id", teamContext.ownerId).single(),
    getUserAccessProfile(user.id),
    getPlanEntitlements(user.id),
  ]);

  const cabinetName = cabinetRes.data?.nom_cabinet || profileRes.data?.company || null;

  return (
    <FiduciaireShell
      userName={profileRes.data?.full_name}
      userEmail={user.email}
      cabinetName={cabinetName}
      permissions={access.permissions}
      roleLabel={access.roleLabel}
      entitlements={entitlements}
      ownerId={teamContext.ownerId}
    >
      {children}
    </FiduciaireShell>
  );
}

import AppShell from "@/components/AppShell";
import DossierBanner from "@/components/DossierBanner";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserAccessProfile, resolveTeamContext } from "@/lib/team";
import { getPlanEntitlements } from "@/lib/plan-entitlements";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  const cookieStore = await cookies();
  const activeDossierId = cookieStore.get("active_dossier_id")?.value;
  const isFiduciaire = user.user_metadata?.user_type === "fiduciaire";
  const teamContext = await resolveTeamContext(user.id);


  const [profileRes, dossierRes, companyRes, access, entitlements] = await Promise.all([
    supabase.from("users").select("full_name, company").eq("id", user.id).single(),
    activeDossierId
      ? supabase.from("dossiers").select("id, raison_sociale, ice, regime_tva")
          .eq("id", activeDossierId).eq("fiduciaire_user_id", user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("companies").select("subscription_status, subscription_ends_at, trial_ends_at, is_suspended, suspended_reason").eq("user_id", teamContext?.ownerId ?? user.id).maybeSingle(),
    getUserAccessProfile(user.id),
    getPlanEntitlements(user.id),
  ]);

  return (
    <AppShell
      userId={user.id}
      ownerId={teamContext?.ownerId ?? user.id}
      userEmail={user.email}
      userName={profileRes.data?.full_name}
      userCompany={profileRes.data?.company}
      isFiduciaire={isFiduciaire}
      permissions={access.permissions}
      roleLabel={access.roleLabel}
      entitlements={entitlements}
      accountState={companyRes.data}>
      {dossierRes.data && <DossierBanner dossier={dossierRes.data} />}
      {children}
    </AppShell>
  );
}

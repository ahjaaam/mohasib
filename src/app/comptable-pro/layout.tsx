import AppShell from "@/components/AppShell";
import AccessRestricted from "@/components/AccessRestricted";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserAccessProfile, resolveTeamContext } from "@/lib/team";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { canEnterScope } from "@/lib/rbac";
import { isAccountApproved } from "@/lib/account-approval";

export default async function ComptableProLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");
  if (!(await isAccountApproved(user.id))) redirect("/en-attente");
  const teamContext = await resolveTeamContext(user.id);
  const isFiduciaire = teamContext?.track === "comptable";
  const scopeAllowed = await canEnterScope({ userId: user.id }, "comptable_pro");

  const ownerId = teamContext?.ownerId ?? user.id;
  const [profileRes, dossiersRes, preferencesRes, access, entitlements] = await Promise.all([
    supabase.from("users").select("full_name, avatar_url").eq("id", user.id).single(),
    supabase.from("dossiers").select("id, raison_sociale")
      .eq("fiduciaire_user_id", ownerId).eq("statut", "actif").order("raison_sociale"),
    supabase.from("user_preferences").select("sidebar_theme").eq("user_id", ownerId).maybeSingle(),
    getUserAccessProfile(user.id),
    getPlanEntitlements(user.id),
  ]);

  return (
    <AppShell
      userId={user.id}
      ownerId={ownerId}
      userEmail={user.email}
      userName={profileRes.data?.full_name ?? user.user_metadata?.full_name ?? user.email}
      userCompany={teamContext?.accountName}
      cabinetCompanies={(dossiersRes.data ?? [])
        .filter((item) => !access.dossierScope?.length || access.dossierScope.includes(item.id))
        .map((item) => ({ id: item.id, name: item.raison_sociale }))}
      userAvatar={profileRes.data?.avatar_url}
      isFiduciaire={isFiduciaire}
      permissions={access.permissions}
      roleLabel={access.roleLabel}
      accessScope={access.accessScope}
      entitlements={entitlements}
      sidebarTheme={preferencesRes.data?.sidebar_theme === "dark" ? "dark" : "cream"}
    >
      {isFiduciaire && scopeAllowed ? children : (
        <AccessRestricted backHref="/tableau-de-bord" message="Vous n'avez pas accès à l'espace Comptable Pro." />
      )}
    </AppShell>
  );
}

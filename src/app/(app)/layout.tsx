import AppShell from "@/components/AppShell";
import AccessRestricted from "@/components/AccessRestricted";
import DossierBanner from "@/components/DossierBanner";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserAccessProfile, resolveTeamContext } from "@/lib/team";
import { getPlanEntitlements } from "@/lib/plan-entitlements";
import { canEnterScope } from "@/lib/rbac";
import { isAccountApproved } from "@/lib/account-approval";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");
  if (!(await isAccountApproved(user.id))) redirect("/en-attente");

  const cookieStore = await cookies();
  const activeDossierId = cookieStore.get("active_dossier_id")?.value;
  const teamContext = await resolveTeamContext(user.id);
  const isFiduciaire = teamContext?.track === "comptable";
  const businessScopeAllowed = await canEnterScope({ userId: user.id }, "business");


  const [profileRes, dossierRes, companyRes, preferencesRes, access, entitlements] = await Promise.all([
    supabase.from("users").select("full_name, company, avatar_url").eq("id", user.id).single(),
    activeDossierId
      ? supabase.from("dossiers").select("id, raison_sociale, ice, regime_tva")
          .eq("id", activeDossierId).eq("fiduciaire_user_id", teamContext?.ownerId ?? user.id).single()
      : Promise.resolve({ data: null }),
    supabase.from("companies").select("subscription_status, subscription_ends_at, trial_ends_at, is_suspended, suspended_reason, trial_invoices_used, trial_ocr_used, trial_documents_used, trial_bank_statements_used, trial_employees_used, trial_tva_declarations_used, trial_dossiers_used, trial_clients_used, trial_transactions_used, trial_accounting_entries_used, trial_rapprochement_sessions_used, trial_rapprochement_matches_used").eq("user_id", teamContext?.ownerId ?? user.id).maybeSingle(),
    supabase.from("user_preferences").select("sidebar_theme").eq("user_id", teamContext?.ownerId ?? user.id).maybeSingle(),
    getUserAccessProfile(user.id),
    getPlanEntitlements(user.id),
  ]);

  return (
    <AppShell
      userId={user.id}
      ownerId={teamContext?.ownerId ?? user.id}
      userEmail={user.email}
      userName={profileRes.data?.full_name ?? user.user_metadata?.full_name ?? user.email}
      userCompany={profileRes.data?.company}
      userAvatar={profileRes.data?.avatar_url}
      isFiduciaire={isFiduciaire}
      permissions={access.permissions}
      roleLabel={access.roleLabel}
      accessScope={access.accessScope}
      entitlements={entitlements}
      sidebarTheme={preferencesRes.data?.sidebar_theme === "dark" ? "dark" : "cream"}
      accountState={companyRes.data}>
      {businessScopeAllowed && dossierRes.data && <DossierBanner dossier={dossierRes.data} />}
      {businessScopeAllowed ? children : (
        <AccessRestricted backHref="/comptable-pro" message="Vous n'avez pas accès à cet espace." />
      )}
    </AppShell>
  );
}

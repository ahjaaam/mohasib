import { createClient } from "@/lib/supabase/server";
import SettingsShell from "./SettingsShell";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { getUserAccessProfile } from "@/lib/team";
import AccessRestricted from "@/components/AccessRestricted";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const access = await getUserAccessProfile(user!.id);
  if (!access.isOwner) return <AccessRestricted backHref="/tableau-de-bord" />;

  const ownerId = await resolveAccountOwnerId(user!.id);

  const [profileRes, companyRes, prefsRes] = await Promise.all([
    supabase.from("users").select("*").eq("id", user!.id).single(),
    supabase.from("companies").select("*").eq("user_id", ownerId).single(),
    supabase.from("user_preferences").select("*").eq("user_id", ownerId).single(),
  ]);

  if (companyRes.error || !companyRes.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Impossible de charger les paramètres de l&apos;entreprise. Aucune donnée n&apos;a été modifiée.
        Rechargez la page ou vérifiez l&apos;accès du compte.
      </div>
    );
  }

  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("id, created_at, user_email, action, entity_type, entity_label, success, request_path")
    .eq("company_id", companyRes.data.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <SettingsShell
      userId={user!.id}
      accountOwnerId={ownerId}
      userEmail={user!.email ?? ""}
      companyId={companyRes.data?.id ?? null}
      profile={profileRes.data ?? {}}
      company={companyRes.data}
      prefs={prefsRes.data ?? {}}
      auditLogs={auditLogs ?? []}
    />
  );
}

export const dynamic = "force-dynamic";

import DossierShell from "@/components/DossierShell";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessProfile, resolveTeamContext } from "@/lib/team";
import { getPlanEntitlements } from "@/lib/plan-entitlements";

export default async function DossierLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");
  const [access, teamContext] = await Promise.all([
    getUserAccessProfile(user.id),
    resolveTeamContext(user.id),
  ]);
  if (teamContext?.track !== "comptable") notFound();
  if (access.permissions !== null && access.dossierScope?.length && !access.dossierScope.includes(id)) notFound();
  const db = access.permissions === null ? supabase : createAdminClient();
  const ownerId = teamContext.ownerId;
  if (!ownerId) notFound();
  let dossiersQuery = db
    .from("dossiers")
    .select("id, raison_sociale, ice, regime_tva")
    .eq("fiduciaire_user_id", ownerId)
    .eq("statut", "actif");
  if (access.permissions !== null && access.dossierScope?.length) dossiersQuery = dossiersQuery.in("id", access.dossierScope);

  const [dossierRes, dossiersRes, profileRes, entitlements] = await Promise.all([
    db
      .from("dossiers")
      .select("id, raison_sociale, ice, regime_tva")
      .eq("id", id)
      .eq("fiduciaire_user_id", ownerId)
      .eq("statut", "actif")
      .single(),
    dossiersQuery.order("raison_sociale"),
    supabase.from("users").select("full_name, avatar_url").eq("id", user.id).single(),
    getPlanEntitlements(user.id),
  ]);

  if (!dossierRes.data) notFound();

  return (
    <DossierShell
      dossier={dossierRes.data}
      dossiers={dossiersRes.data ?? [dossierRes.data]}
      userId={user.id}
      userName={profileRes.data?.full_name}
      userEmail={user.email}
      userAvatar={profileRes.data?.avatar_url}
      permissions={access.permissions}
      roleLabel={access.roleLabel}
      isClientPortal={access.roleName === "client_portal"}
      entitlements={entitlements}
      ownerId={ownerId}
    >
      {children}
    </DossierShell>
  );
}

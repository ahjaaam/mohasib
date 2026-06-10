export const dynamic = "force-dynamic";

import DossierShell from "@/components/DossierShell";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAccessProfile } from "@/lib/team";

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
  const access = await getUserAccessProfile(user.id);
  if (access.permissions !== null && !access.dossierScope?.includes(id)) notFound();
  const db = access.permissions === null ? supabase : createAdminClient();
  const ownerId = access.permissions === null
    ? user.id
    : (await createAdminClient().from("dossiers").select("fiduciaire_user_id").eq("id", id).maybeSingle()).data?.fiduciaire_user_id;
  if (!ownerId) notFound();
  let dossiersQuery = db
    .from("dossiers")
    .select("id, raison_sociale, ice, regime_tva")
    .eq("fiduciaire_user_id", ownerId);
  if (access.permissions !== null) dossiersQuery = dossiersQuery.in("id", access.dossierScope?.length ? access.dossierScope : [id]);

  const [dossierRes, dossiersRes, profileRes] = await Promise.all([
    db
      .from("dossiers")
      .select("id, raison_sociale, ice, regime_tva")
      .eq("id", id)
      .eq("fiduciaire_user_id", ownerId)
      .single(),
    dossiersQuery.order("raison_sociale"),
    supabase.from("users").select("full_name").eq("id", user.id).single(),
  ]);

  if (!dossierRes.data) notFound();

  return (
    <DossierShell
      dossier={dossierRes.data}
      dossiers={dossiersRes.data ?? [dossierRes.data]}
      userName={profileRes.data?.full_name}
      userEmail={user.email}
      permissions={access.permissions}
      roleLabel={access.roleLabel}
    >
      {children}
    </DossierShell>
  );
}

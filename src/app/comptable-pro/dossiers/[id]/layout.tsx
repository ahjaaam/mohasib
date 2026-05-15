export const dynamic = "force-dynamic";

import DossierShell from "@/components/DossierShell";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

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

  if (!user) redirect("/auth/login");

  const [dossierRes, profileRes] = await Promise.all([
    supabase
      .from("dossiers")
      .select("id, raison_sociale, ice, regime_tva")
      .eq("id", id)
      .eq("fiduciaire_user_id", user.id)
      .single(),
    supabase.from("users").select("full_name").eq("id", user.id).single(),
  ]);

  if (!dossierRes.data) notFound();

  return (
    <DossierShell
      dossier={dossierRes.data}
      userName={profileRes.data?.full_name}
      userEmail={user.email}
    >
      {children}
    </DossierShell>
  );
}

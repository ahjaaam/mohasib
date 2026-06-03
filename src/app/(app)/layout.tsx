import AppShell from "@/components/AppShell";
import DossierBanner from "@/components/DossierBanner";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/connexion");

  const cookieStore = await cookies();
  const activeDossierId = cookieStore.get("active_dossier_id")?.value;
  const isFiduciaire = user.user_metadata?.user_type === "fiduciaire";


  const [profileRes, dossierRes] = await Promise.all([
    supabase.from("users").select("full_name, company").eq("id", user.id).single(),
    activeDossierId
      ? supabase.from("dossiers").select("id, raison_sociale, ice, regime_tva")
          .eq("id", activeDossierId).eq("fiduciaire_user_id", user.id).single()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <AppShell
      userId={user.id}
      userEmail={user.email}
      userName={profileRes.data?.full_name}
      userCompany={profileRes.data?.company}
      isFiduciaire={isFiduciaire}>
      {dossierRes.data && <DossierBanner dossier={dossierRes.data} />}
      {children}
    </AppShell>
  );
}

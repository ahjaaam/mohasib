import FiduciaireShell from "@/components/FiduciaireShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function FiduciaireLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [profileRes, cabinetRes] = await Promise.all([
    supabase.from("users").select("full_name, company").eq("id", user.id).single(),
    supabase.from("cabinets").select("nom_cabinet").eq("user_id", user.id).single(),
  ]);

  const cabinetName = cabinetRes.data?.nom_cabinet || profileRes.data?.company || null;

  return (
    <FiduciaireShell
      userName={profileRes.data?.full_name}
      userEmail={user.email}
      cabinetName={cabinetName}
    >
      {children}
    </FiduciaireShell>
  );
}

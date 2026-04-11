import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch profile for name/company
  const { data: profile } = await supabase
    .from("users")
    .select("full_name, company")
    .eq("id", user.id)
    .single();

  return (
    <AppShell
      userId={user.id}
      userEmail={user.email}
      userName={profile?.full_name}
      userCompany={profile?.company}>
      {children}
    </AppShell>
  );
}

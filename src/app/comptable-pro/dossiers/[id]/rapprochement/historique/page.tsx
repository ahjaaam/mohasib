export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RapprochementHistory from "@/app/(app)/rapprochement/RapprochementHistory";

export default async function DossierRapprochementHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const admin = createAdminClient();
  const { data: membership } = await admin.from("user_memberships")
    .select("role_name")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (membership?.role_name === "client_portal") notFound();

  return <RapprochementHistory dossierId={id} />;
}

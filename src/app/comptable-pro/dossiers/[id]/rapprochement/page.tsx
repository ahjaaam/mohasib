export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import RapprochementPage from "@/app/(app)/rapprochement/page";

export default async function DossierRapprochementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  // Rapprochement is accountant-only tooling — a client-portal member reuses
  // the same accounting:read permission as Transactions, so this needs an
  // explicit role check rather than relying on the permission string alone.
  const admin = createAdminClient();
  const { data: membership } = await admin.from("user_memberships")
    .select("role_name")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (membership?.role_name === "client_portal") notFound();

  return <RapprochementPage dossierId={id} />;
}

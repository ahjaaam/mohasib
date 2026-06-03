export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InboxGlobalClient from "./InboxGlobalClient";

export default async function InboxGlobalPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  const [itemsRes, dossiersRes] = await Promise.all([
    supabase
      .from("inbox_global")
      .select("*, ai_suggested_dossier:ai_suggested_dossier_id(id, raison_sociale), assigned_dossier:assigned_dossier_id(id, raison_sociale)")
      .eq("fiduciaire_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("dossiers")
      .select("id, raison_sociale")
      .eq("fiduciaire_user_id", user.id)
      .eq("statut", "actif")
      .order("raison_sociale"),
  ]);

  return (
    <InboxGlobalClient
      items={(itemsRes.data ?? []) as any[]}
      dossiers={(dossiersRes.data ?? []) as { id: string; raison_sociale: string }[]}
    />
  );
}

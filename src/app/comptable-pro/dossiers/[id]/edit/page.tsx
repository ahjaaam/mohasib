export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserAccessProfile } from "@/lib/team";
import EditDossierForm from "./EditDossierForm";

export default async function EditDossierPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");

  // Dossier identity + client-access management are cabinet-only.
  const access = await getUserAccessProfile(user.id);
  if (access.roleName === "client_portal") notFound();

  return <EditDossierForm />;
}

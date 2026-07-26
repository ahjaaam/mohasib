export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveClientPortalRedirect } from "@/lib/team";
import NewDossierForm from "./NewDossierForm";

export default async function NewDossierPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const clientRedirect = await resolveClientPortalRedirect(user.id);
  if (clientRedirect) redirect(clientRedirect);

  return <NewDossierForm />;
}

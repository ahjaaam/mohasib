import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/email-oauth";

export async function POST() {
  const { companyId } = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("outlook_token_encrypted")
    .eq("id", companyId)
    .maybeSingle();

  if (!company?.outlook_token_encrypted) {
    return NextResponse.json({ error: "Outlook n'est pas connecté." }, { status: 400 });
  }

  await admin.from("companies").update({ outlook_last_sync: new Date().toISOString() }).eq("id", companyId);
  return NextResponse.json({
    messagesFound: 0,
    imported: 0,
    message: "Connexion Outlook active. La synchronisation d'emails sera branchée au moteur d'import.",
  });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/email-oauth";

export async function POST() {
  const { companyId } = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: company } = await admin
    .from("companies")
    .select("gmail_token_encrypted")
    .eq("id", companyId)
    .maybeSingle();

  if (!company?.gmail_token_encrypted) {
    return NextResponse.json({ error: "Gmail n'est pas connecté." }, { status: 400 });
  }

  await admin.from("companies").update({ gmail_last_sync: new Date().toISOString() }).eq("id", companyId);
  return NextResponse.json({
    messagesFound: 0,
    imported: 0,
    message: "Connexion Gmail active. La synchronisation d'emails sera branchée au moteur d'import.",
  });
}

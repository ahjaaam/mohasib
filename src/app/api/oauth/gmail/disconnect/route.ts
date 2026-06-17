import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/email-oauth";

export async function POST() {
  const { companyId } = await getCurrentCompanyId();
  if (!companyId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from("companies").update({
    gmail_token_encrypted: null,
    gmail_email: null,
    gmail_label_id: null,
    gmail_connected_at: null,
    gmail_last_sync: null,
  }).eq("id", companyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

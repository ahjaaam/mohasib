import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { syncOutlook } from "@/lib/email-sync";

const serviceSupabase = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: company } = await supabase
    .from("companies")
    .select("id, outlook_token_encrypted")
    .eq("user_id", user.id)
    .single();

  if (!company?.outlook_token_encrypted) {
    return NextResponse.json({ error: "Outlook non connecté" }, { status: 400 });
  }

  try {
    const imported = await syncOutlook(
      serviceSupabase,
      company.id,
      user.id,
      company.outlook_token_encrypted,
    );
    return NextResponse.json({ imported });
  } catch (err: any) {
    console.error("[Outlook sync]", err);
    return NextResponse.json({ error: err?.message ?? "Sync failed" }, { status: 500 });
  }
}

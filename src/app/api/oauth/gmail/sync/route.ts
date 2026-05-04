import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { syncGmail } from "@/lib/email-sync";

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
    .select("id, gmail_token_encrypted, gmail_label_id")
    .eq("user_id", user.id)
    .single();

  if (!company?.gmail_token_encrypted) {
    return NextResponse.json({ error: "Gmail non connecté" }, { status: 400 });
  }

  try {
    const imported = await syncGmail(
      serviceSupabase,
      company.id,
      user.id,
      company.gmail_token_encrypted,
      company.gmail_label_id ?? null,
    );
    return NextResponse.json({ imported });
  } catch (err: any) {
    console.error("[Gmail sync]", err);
    return NextResponse.json({ error: err?.message ?? "Sync failed" }, { status: 500 });
  }
}

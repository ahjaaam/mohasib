import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncGmail, syncOutlook } from "@/lib/email-sync";

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function GET(req: NextRequest) {
  // Authenticate cron requests
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get all companies with at least one email integration connected
  const { data: companies, error } = await serviceSupabase
    .from("companies")
    .select("id, user_id, gmail_token_encrypted, gmail_label_id, outlook_token_encrypted")
    .or("gmail_token_encrypted.not.is.null,outlook_token_encrypted.not.is.null");

  if (error) {
    console.error("[cron/sync-emails] DB error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let totalImported = 0;
  const results: Record<string, { gmail?: number; outlook?: number; error?: string }> = {};

  for (const company of companies ?? []) {
    results[company.id] = {};

    if (company.gmail_token_encrypted) {
      try {
        const { imported: n } = await syncGmail(
          serviceSupabase,
          company.id,
          company.user_id,
          company.gmail_token_encrypted,
          company.gmail_label_id ?? null,
        );
        results[company.id].gmail = n;
        totalImported += n;
      } catch (err: any) {
        console.error(`[cron] Gmail sync failed for company ${company.id}:`, err?.message);
        results[company.id].error = err?.message;
      }
    }

    if (company.outlook_token_encrypted) {
      try {
        const n = await syncOutlook(
          serviceSupabase,
          company.id,
          company.user_id,
          company.outlook_token_encrypted,
        );
        results[company.id].outlook = n;
        totalImported += n;
      } catch (err: any) {
        console.error(`[cron] Outlook sync failed for company ${company.id}:`, err?.message);
        results[company.id].error = err?.message;
      }
    }
  }

  console.log(`[cron/sync-emails] Done. ${totalImported} documents imported across ${companies?.length ?? 0} companies.`);
  return NextResponse.json({ ok: true, totalImported, results });
}

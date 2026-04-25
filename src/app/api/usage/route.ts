import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyUsage } from "@/lib/usage";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).single();
  if (!company) {
    return NextResponse.json({ allowed: true, used: 0, limit: 200, remaining: 200, resetDate: "" });
  }

  const usage = await getMonthlyUsage(company.id);
  return NextResponse.json(usage);
}

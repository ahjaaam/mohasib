import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCnssDeclaration } from "@/lib/paie/cnss-declaration";
import { requirePlanFeature } from "@/lib/api-plan";

export async function GET(req: NextRequest) {
  try {
    const plan = await requirePlanFeature("paie");
    if (plan.response) return plan.response;
    const { searchParams } = new URL(req.url);
    const mois = Number(searchParams.get("mois"));
    const annee = Number(searchParams.get("annee"));
    const dossierId = searchParams.get("dossierId");
    if (!mois || !annee) return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const data = await buildCnssDeclaration({ supabase, userId: user.id, mois, annee, dossierId });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";
import { requirePlanFeature } from "@/lib/api-plan";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const plan = await requirePlanFeature("paie");
  if (plan.response) return plan.response;
  const { id } = await params;
  const supabase = await createClient();
  const { data: declaration } = await supabase.from("cnss_declarations").select("mois,annee,company_id,dossier_id").eq("id", id).single();
  if (!declaration) return NextResponse.json({ error: "Déclaration introuvable" }, { status: 404 });
  const permission = await authorizePermission("bulletin_paie", "read", { companyId: declaration.company_id, dossierId: declaration.dossier_id });
  if (permission.response) return permission.response;
  const url = new URL("/api/paie/cnss-declaration/pdf", req.url);
  url.searchParams.set("mois", String(declaration.mois));
  url.searchParams.set("annee", String(declaration.annee));
  if (declaration.dossier_id) url.searchParams.set("dossierId", declaration.dossier_id);
  return NextResponse.redirect(url);
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFeatureEnabled } from "@/lib/api-features";
import { getAccountLabel } from "@/lib/cgnc-mapping";

export async function POST(req: NextRequest) {
  const gate = requireFeatureEnabled("SAISIE_ENABLED");
  if (gate.response) return gate.response;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { companyId, journal, date, numero_piece, compte, libelle, debit, credit } = body ?? {};
  if (!companyId || !journal || !date || !libelle) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("user_id", user.id)
    .single();
  if (!company) return NextResponse.json({ error: "Entreprise introuvable" }, { status: 404 });

  const { data, error } = await supabase
    .from("ecritures_comptables")
    .insert({
      company_id: companyId,
      journal,
      date_ecriture: date,
      numero_piece: numero_piece || null,
      compte: compte || null,
      compte_label: compte ? getAccountLabel(compte) : null,
      libelle: String(libelle).trim(),
      debit: Number(debit) || 0,
      credit: Number(credit) || 0,
      source_type: "manual",
      is_validated: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

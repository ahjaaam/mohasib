import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFeatureEnabled } from "@/lib/api-features";
import { getAccountLabel } from "@/lib/cgnc-mapping";

async function resolveOwnedEcriture(supabase: any, userId: string, id: string) {
  const { data: ecriture } = await supabase
    .from("ecritures_comptables")
    .select("id, company_id, companies!inner(user_id)")
    .eq("id", id)
    .single();
  if (!ecriture || ecriture.companies?.user_id !== userId) return null;
  return ecriture;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = requireFeatureEnabled("SAISIE_ENABLED");
  if (gate.response) return gate.response;

  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const owned = await resolveOwnedEcriture(supabase, user.id, id);
  if (!owned) return NextResponse.json({ error: "Écriture introuvable" }, { status: 404 });

  const body = await req.json();
  const { date, numero_piece, compte, libelle, debit, credit } = body ?? {};

  const { data, error } = await supabase
    .from("ecritures_comptables")
    .update({
      date_ecriture: date,
      numero_piece: numero_piece || null,
      compte: compte || null,
      compte_label: compte ? getAccountLabel(compte) : null,
      libelle: String(libelle ?? "").trim(),
      debit: Number(debit) || 0,
      credit: Number(credit) || 0,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = requireFeatureEnabled("SAISIE_ENABLED");
  if (gate.response) return gate.response;

  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const owned = await resolveOwnedEcriture(supabase, user.id, id);
  if (!owned) return NextResponse.json({ error: "Écriture introuvable" }, { status: 404 });

  const { error } = await supabase.from("ecritures_comptables").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

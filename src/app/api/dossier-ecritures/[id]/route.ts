import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFeatureEnabled } from "@/lib/api-features";

async function resolveOwnedEcriture(supabase: any, userId: string, id: string) {
  const { data: ecriture } = await supabase
    .from("dossier_ecritures")
    .select("id, dossier_id, periode, dossiers!inner(fiduciaire_user_id)")
    .eq("id", id)
    .single();
  if (!ecriture || ecriture.dossiers?.fiduciaire_user_id !== userId) return null;
  return ecriture;
}

async function isPeriodLocked(supabase: any, dossierId: string, periode: string) {
  const { data } = await supabase
    .from("dossier_clotures")
    .select("id")
    .eq("dossier_id", dossierId)
    .eq("periode", periode)
    .maybeSingle();
  return !!data;
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
  if (await isPeriodLocked(supabase, owned.dossier_id, owned.periode)) {
    return NextResponse.json({ error: "Période clôturée" }, { status: 403 });
  }

  const body = await req.json();
  const { date, numero_piece, compte_cgnc, libelle, debit, credit } = body ?? {};

  const { data, error } = await supabase
    .from("dossier_ecritures")
    .update({
      date,
      numero_piece: numero_piece || null,
      compte_cgnc: compte_cgnc || null,
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
  if (await isPeriodLocked(supabase, owned.dossier_id, owned.periode)) {
    return NextResponse.json({ error: "Période clôturée" }, { status: 403 });
  }

  const { error } = await supabase.from("dossier_ecritures").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ success: true });
}

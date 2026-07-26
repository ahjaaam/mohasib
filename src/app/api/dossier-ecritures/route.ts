import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireFeatureEnabled } from "@/lib/api-features";

export async function POST(req: NextRequest) {
  const gate = requireFeatureEnabled("SAISIE_ENABLED");
  if (gate.response) return gate.response;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();
  const { dossierId, periode, journal, date, numero_piece, compte_cgnc, libelle, debit, credit } = body ?? {};
  if (!dossierId || !periode || !journal || !date || !libelle) {
    return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
  }

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("id")
    .eq("id", dossierId)
    .eq("fiduciaire_user_id", user.id)
    .single();
  if (!dossier) return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });

  const { data: cloture } = await supabase
    .from("dossier_clotures")
    .select("id")
    .eq("dossier_id", dossierId)
    .eq("periode", periode)
    .maybeSingle();
  if (cloture) return NextResponse.json({ error: "Période clôturée" }, { status: 403 });

  const { data, error } = await supabase
    .from("dossier_ecritures")
    .insert({
      dossier_id: dossierId,
      fiduciaire_user_id: user.id,
      periode,
      journal,
      date,
      numero_piece: numero_piece || null,
      compte_cgnc: compte_cgnc || null,
      libelle: String(libelle).trim(),
      debit: Number(debit) || 0,
      credit: Number(credit) || 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabase.from("dossiers").update({ derniere_ecriture: new Date().toISOString() }).eq("id", dossierId);
  return NextResponse.json({ data });
}

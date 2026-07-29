import { NextResponse } from "next/server";
import { logAdminAudit, requireAdminApi } from "@/lib/admin-api";

const STATUSES = ["actif", "inactif"] as const;
const TVA_REGIMES = ["mensuel", "trimestriel", "exonere"] as const;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;

  const body = await request.json();
  const { data: workspace } = await admin!.from("dossiers").select("*").eq("id", id).maybeSingle();
  if (!workspace) return NextResponse.json({ message: "Espace client introuvable" }, { status: 404 });

  if (!STATUSES.includes(body.statut)) {
    return NextResponse.json({ message: "Statut d'espace invalide" }, { status: 400 });
  }
  if (!TVA_REGIMES.includes(body.regime_tva)) {
    return NextResponse.json({ message: "Régime TVA invalide" }, { status: 400 });
  }
  const raisonSociale = String(body.raison_sociale ?? "").trim();
  if (!raisonSociale) return NextResponse.json({ message: "La raison sociale est obligatoire" }, { status: 400 });

  const values = {
    raison_sociale: raisonSociale,
    statut: body.statut,
    regime_tva: body.regime_tva,
    contact_nom: String(body.contact_nom ?? "").trim() || null,
    contact_email: String(body.contact_email ?? "").trim().toLowerCase() || null,
    contact_phone: String(body.contact_phone ?? "").trim() || null,
    notes: String(body.notes ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };
  const update = await admin!.from("dossiers").update(values).eq("id", id);
  if (update.error) return NextResponse.json({ message: update.error.message }, { status: 400 });
  if (body.statut === "inactif") {
    await admin!.from("user_memberships")
      .update({ status: "suspended" })
      .eq("dossier_id", id)
      .eq("role_name", "client_portal")
      .in("status", ["active", "invited"]);
  }

  const { data: company } = await admin!.from("companies").select("id").eq("user_id", workspace.fiduciaire_user_id).maybeSingle();
  await logAdminAudit({
    adminEmail: user!.email!,
    action: "WORKSPACE_UPDATE",
    entityType: "dossier",
    entityId: id,
    entityLabel: raisonSociale,
    companyId: company?.id,
    oldValues: workspace,
    newValues: values,
  });
  return NextResponse.json({ ok: true });
}

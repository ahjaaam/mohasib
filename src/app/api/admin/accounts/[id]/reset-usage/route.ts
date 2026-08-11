import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";

const COUNTERS = ["ocr_used_this_month", "trial_invoices_used", "trial_ocr_used", "trial_documents_used", "trial_bank_statements_used", "trial_employees_used", "trial_tva_declarations_used", "trial_dossiers_used", "trial_clients_used", "trial_transactions_used", "trial_accounting_entries_used", "trial_rapprochement_sessions_used", "trial_rapprochement_matches_used"];

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  const { data: company } = await admin!.from("companies").select(`raison_sociale,${COUNTERS.join(",")}`).eq("id", id).maybeSingle();
  if (!company) return NextResponse.json({ message: "Compte introuvable." }, { status: 404 });
  const values = Object.fromEntries(COUNTERS.map(counter => [counter, 0]));
  const result = await admin!.from("companies").update(values).eq("id", id);
  if (result.error) return NextResponse.json({ message: result.error.message }, { status: 400 });
  await logAdminAudit({ adminEmail: user!.email!, action: "ACCOUNT_USAGE_RESET", entityType: "company", entityId: id, entityLabel: company.raison_sociale, companyId: id, oldValues: company, newValues: values });
  return NextResponse.json({ ok: true });
}

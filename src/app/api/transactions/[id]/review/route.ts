import { NextRequest, NextResponse } from "next/server";
import { authorizePermission } from "@/lib/api-permissions";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { createClient } from "@/lib/supabase/server";
import {
  prorateVatEvidence,
  readExplicitVatEvidence,
  validateReviewChoice,
  type TransactionVatStatus,
} from "@/lib/transaction-review";
import { isValidAccountingAccountCode } from "@/lib/accounting-settings";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { data: transaction } = await supabase
      .from("transactions")
      .select("id,user_id,dossier_id,type,amount,date,description,workflow_status,vat_status,counterpart_account")
      .eq("id", id)
      .maybeSingle();
    if (!transaction) return NextResponse.json({ error: "Transaction introuvable" }, { status: 404 });

    const permission = await authorizePermission("accounting", "create", { dossierId: transaction.dossier_id });
    if (permission.response) return permission.response;
    if (transaction.workflow_status === "posted") {
      return NextResponse.json({ error: "Cette transaction est déjà comptabilisée." }, { status: 409 });
    }

    const body = await request.json().catch(() => ({}));
    const counterpartAccount = String(body.counterpartAccount ?? "").trim();
    const vatStatus = String(body.vatStatus ?? "") as TransactionVatStatus;
    const reviewReason = String(body.reviewReason ?? "").trim().slice(0, 500);
    const allowedVatStatuses: TransactionVatStatus[] = ["not_applicable", "pending_evidence", "eligible", "rejected"];
    if (!allowedVatStatuses.includes(vatStatus)) {
      return NextResponse.json({ error: "Statut TVA invalide." }, { status: 400 });
    }

    const allowedCounterpartClasses = transaction.type === "income" ? [3, 4, 7] : [2, 4, 6];
    if (!isValidAccountingAccountCode(counterpartAccount, allowedCounterpartClasses)) {
      return NextResponse.json({ error: "Compte comptable incompatible avec la transaction." }, { status: 400 });
    }
    const choiceError = validateReviewChoice({
      transactionType: transaction.type,
      vatStatus,
      reason: reviewReason,
    });
    if (choiceError) return NextResponse.json({ error: choiceError }, { status: 400 });

    const update: Record<string, unknown> = {
      workflow_status: "reviewed",
      vat_status: vatStatus,
      counterpart_account: counterpartAccount,
      review_reason: reviewReason || null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      vat_evidence_receipt_id: null,
      tax_rate: null,
      tax_amount: null,
      amount_ht: null,
    };

    if (vatStatus === "eligible") {
      const { data: allocations, error: allocationsError } = await supabase
        .from("invoice_payments")
        .select("montant,inbox_item_id")
        .eq("transaction_id", transaction.id)
        .eq("allocation_status", "confirmed")
        .not("inbox_item_id", "is", null);
      if (allocationsError) throw allocationsError;
      if (!allocations || allocations.length !== 1 || !allocations[0].inbox_item_id) {
        return NextResponse.json({
          error: "La TVA déductible exige exactement un document fournisseur confirmé.",
        }, { status: 400 });
      }

      const { data: receipt } = await supabase
        .from("receipts")
        .select("id,user_id,dossier_id,storage_path,file_name,document_area,ocr_data")
        .eq("id", allocations[0].inbox_item_id)
        .maybeSingle();
      const inSameScope = receipt && receipt.dossier_id === transaction.dossier_id
        && (transaction.dossier_id != null || receipt.user_id === transaction.user_id);
      if (!inSameScope || !receipt?.storage_path || !["purchase", "legacy"].includes(receipt.document_area)) {
        return NextResponse.json({ error: "Le justificatif fournisseur est absent ou invalide." }, { status: 400 });
      }

      const evidence = readExplicitVatEvidence((receipt.ocr_data ?? {}) as Record<string, unknown>);
      const prorated = evidence && prorateVatEvidence(evidence, Number(allocations[0].montant));
      if (!evidence || !prorated) {
        return NextResponse.json({
          error: "Le justificatif doit contenir des montants TTC, HT, TVA et un taux explicites et cohérents.",
        }, { status: 400 });
      }
      update.vat_evidence_receipt_id = receipt.id;
      update.receipt_id = receipt.id;
      update.tax_rate = prorated.taxRate;
      update.tax_amount = prorated.taxAmount;
      update.amount_ht = prorated.amountHt;
    }

    const { data: reviewed, error } = await supabase
      .from("transactions")
      .update(update)
      .eq("id", transaction.id)
      .neq("workflow_status", "posted")
      .select("id,workflow_status,vat_status,counterpart_account,review_reason,reviewed_at")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logAudit({
      userId: user.id,
      userEmail: user.email ?? null,
      dossierId: transaction.dossier_id,
      action: "REVIEW",
      entityType: "transaction",
      entityId: transaction.id,
      entityLabel: transaction.description,
      oldValues: {
        workflow_status: transaction.workflow_status,
        vat_status: transaction.vat_status,
        counterpart_account: transaction.counterpart_account,
      },
      newValues: reviewed,
      changedFields: ["workflow_status", "vat_status", "counterpart_account", "review_reason"],
      ...getRequestMeta(request),
    });

    return NextResponse.json({ ok: true, transaction: reviewed });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "La validation a échoué." }, { status: 500 });
  }
}

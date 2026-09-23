import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  bookAvoirClient,
  bookBankTransaction,
  bookPurchaseInvoice,
  bookSalesInvoice,
  bookSupplierCreditNote,
  type SupplierCreditNoteAdjustmentType,
} from "@/lib/accounting-engine";
import { authorizePermission } from "@/lib/api-permissions";
import { logAccountingEvent, logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { requirePlanFeature } from "@/lib/api-plan";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { enforcePeriodLock } from "@/lib/period-check";
import { computePurchaseAmounts } from "@/lib/purchase-booking";
import { evaluateInvoiceControls } from "@/lib/invoice-controls";
import { isValidAccountingAccountCode, type AccountingSettings } from "@/lib/accounting-settings";
import { isInvoiceBookableStatus } from "@/lib/invoice-accounting-lifecycle";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { type, dossierId } = body as {
      type: "invoice" | "bank" | "purchase" | "avoir" | "supplier_credit_note";
      dossierId?: string;
    };
    if (type === "avoir" || type === "supplier_credit_note") {
      const plan = await requirePlanFeature("avoirs");
      if (plan.response) return plan.response;
    }
    const permission = await authorizePermission("accounting", "create", { dossierId });
    if (permission.response) return permission.response;
    const ownerId = await resolveAccountOwnerId(user.id);

    // Resolve company_id when not in dossier context
    let companyId: string | null = null;
    let accountingSettings: unknown = null;
    if (dossierId) {
      const { data: dossier } = await supabase
        .from("dossiers")
        .select("id, accounting_settings")
        .eq("id", dossierId)
        .eq("fiduciaire_user_id", ownerId)
        .single();
      if (!dossier) {
        return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
      }
      accountingSettings = dossier.accounting_settings;
    } else {
      const { data: co } = await supabase
        .from("companies")
        .select("id, accounting_settings")
        .eq("user_id", ownerId)
        .single();
      companyId = co?.id ?? null;
      if (!companyId) {
        return NextResponse.json({ error: "Aucune société trouvée" }, { status: 400 });
      }
      accountingSettings = co?.accounting_settings ?? null;
    }

    // ── Invoice booking ────────────────────────────────────────────────────────
    if (type === "invoice") {
      const { invoiceId, finalizeDraft } = body as { invoiceId: string; finalizeDraft?: boolean };
      let invoiceQuery = supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, status, total, subtotal, tax_amount, tax_rate, discount_type, discount_amount, items, clients(name)")
        .eq("id", invoiceId);
      invoiceQuery = dossierId ? invoiceQuery.eq("dossier_id", dossierId) : invoiceQuery.is("dossier_id", null);
      const { data: inv } = await invoiceQuery.single();

      if (!inv) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

      const isDraftFinalization = inv.status === "draft" && finalizeDraft === true;
      if (!isDraftFinalization && !isInvoiceBookableStatus(inv.status)) {
        return NextResponse.json(
          { error: "invoice_not_finalized", message: "Un brouillon ne peut pas être comptabilisé." },
          { status: 409 },
        );
      }
      const invoiceMonth = Number(String(inv.issue_date).slice(5, 7));
      const invoiceYear = Number(String(inv.issue_date).slice(0, 4));
      const locked = await enforcePeriodLock(invoiceMonth, invoiceYear, companyId, dossierId ?? null);
      if (locked) return locked;

      await bookSalesInvoice(supabase, {
        id: inv.id,
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date,
        total: Number(inv.total),
        subtotal: Number(inv.subtotal),
        tax_amount: Number(inv.tax_amount),
        discount_type: inv.discount_type,
        discount_amount: Number(inv.discount_amount ?? 0),
        items: (inv.items ?? []) as any[],
        clients: (inv as any).clients,
      }, companyId, dossierId ?? null, accountingSettings as Partial<AccountingSettings> | null, {
        finalizeDraftInvoice: isDraftFinalization,
      });

      await logAudit({
        userId: user.id,
        userEmail: user.email ?? null,
        companyId,
        dossierId: dossierId ?? null,
        action: "CREATE",
        entityType: "ecriture_comptable",
        entityId: inv.id,
        entityLabel: inv.invoice_number,
        newValues: inv as any,
        ...getRequestMeta(req),
      });
      await logAccountingEvent({
        companyId,
        dossierId: dossierId ?? null,
        eventType: "JOURNAL_ENTRY_CREATED",
        triggeredBy: user.id,
        triggeredByEmail: user.email ?? null,
        entityType: "invoice",
        entityId: inv.id,
        amount: Number(inv.total),
        periodMois: inv.issue_date ? Number(String(inv.issue_date).slice(5, 7)) : null,
        periodAnnee: inv.issue_date ? Number(String(inv.issue_date).slice(0, 4)) : null,
        eventData: { source: "accounting/book", invoice: inv },
      });
      return NextResponse.json({ ok: true });
    }

    // ── Supplier credit-note booking ─────────────────────────────────────────
    if (type === "supplier_credit_note") {
      const { creditNoteId } = body as { creditNoteId?: string };
      if (!creditNoteId) {
        return NextResponse.json({ error: "creditNoteId requis" }, { status: 400 });
      }

      let creditNoteQuery = supabase
        .from("avoirs_fournisseurs")
        .select("id, numero_interne, ref_fournisseur, fournisseur, date, montant_ht, tva_amount, total, compte_comptable, statut, adjustment_type, original_purchase_account")
        .eq("id", creditNoteId)
        .eq("user_id", ownerId);
      creditNoteQuery = dossierId
        ? creditNoteQuery.eq("dossier_id", dossierId)
        : creditNoteQuery.is("dossier_id", null);
      const { data: creditNote } = await creditNoteQuery.single();

      if (!creditNote) {
        return NextResponse.json({ error: "Avoir fournisseur introuvable" }, { status: 404 });
      }
      if (creditNote.statut === "comptabilise") {
        return NextResponse.json({ ok: true, alreadyBooked: true });
      }

      const allowedAdjustmentTypes: SupplierCreditNoteAdjustmentType[] = [
        "commercial_reduction",
        "purchase_return",
        "invoice_correction",
        "partial_cancellation",
        "settlement_discount",
        "other",
      ];
      const adjustmentType = creditNote.adjustment_type as SupplierCreditNoteAdjustmentType;
      const originalPurchaseAccount = String(creditNote.original_purchase_account ?? "");
      const supplierAccount = String(creditNote.compte_comptable ?? "");
      const totalHt = Number(creditNote.montant_ht);
      const tvaAmount = Number(creditNote.tva_amount);
      const totalTtc = Number(creditNote.total);
      if (!allowedAdjustmentTypes.includes(adjustmentType)) {
        return NextResponse.json({ error: "Nature de l’avoir fournisseur invalide" }, { status: 400 });
      }
      if (!isValidAccountingAccountCode(originalPurchaseAccount, [2, 6])) {
        return NextResponse.json({ error: "Compte d’achat d’origine invalide" }, { status: 400 });
      }
      if (supplierAccount && !isValidAccountingAccountCode(supplierAccount, [4])) {
        return NextResponse.json({ error: "Compte fournisseur invalide" }, { status: 400 });
      }
      if (!(totalHt > 0) || tvaAmount < 0 || Math.abs(totalHt + tvaAmount - totalTtc) > 0.01) {
        return NextResponse.json({ error: "Montants de l’avoir fournisseur invalides" }, { status: 400 });
      }

      const creditMonth = Number(String(creditNote.date).slice(5, 7));
      const creditYear = Number(String(creditNote.date).slice(0, 4));
      const locked = await enforcePeriodLock(creditMonth, creditYear, companyId, dossierId ?? null);
      if (locked) return locked;

      await bookSupplierCreditNote(supabase, {
        id: creditNote.id,
        number: creditNote.numero_interne,
        date: creditNote.date,
        supplier_name: creditNote.fournisseur,
        total_ht: totalHt,
        tva_amount: tvaAmount,
        total_ttc: totalTtc,
        supplier_account: supplierAccount || null,
        original_purchase_account: originalPurchaseAccount,
        adjustment_type: adjustmentType,
        reference: creditNote.ref_fournisseur,
      }, companyId, dossierId ?? null, accountingSettings as Partial<AccountingSettings> | null, {
        finalizeSupplierCreditNote: true,
      });

      await logAudit({
        userId: user.id,
        userEmail: user.email ?? null,
        companyId,
        dossierId: dossierId ?? null,
        action: "POST",
        entityType: "avoir_fournisseur",
        entityId: creditNote.id,
        entityLabel: creditNote.numero_interne,
        newValues: creditNote as any,
        ...getRequestMeta(req),
      });
      await logAccountingEvent({
        companyId,
        dossierId: dossierId ?? null,
        eventType: "JOURNAL_ENTRY_CREATED",
        triggeredBy: user.id,
        triggeredByEmail: user.email ?? null,
        entityType: "supplier_credit_note",
        entityId: creditNote.id,
        amount: totalTtc,
        periodMois: creditMonth,
        periodAnnee: creditYear,
        eventData: { source: "accounting/book", creditNote },
      });
      return NextResponse.json({ ok: true });
    }

    // ── Bank transaction booking ───────────────────────────────────────────────
    if (type === "bank") {
      const { transactionIds, accountOverrides = {} } = body as {
        transactionIds: string[];
        accountOverrides?: Record<string, string>;
      };
      if (!transactionIds?.length) {
        return NextResponse.json({ error: "transactionIds requis" }, { status: 400 });
      }
      let transactionsQuery = supabase
        .from("transactions")
        .select("id, date, description, amount, type, category, invoice_id, workflow_status, vat_status, counterpart_account, tax_amount")
        .in("id", transactionIds);
      transactionsQuery = dossierId ? transactionsQuery.eq("dossier_id", dossierId) : transactionsQuery.is("dossier_id", null);
      const { data: txs, error: transactionsError } = await transactionsQuery;
      if (transactionsError) throw transactionsError;
      if ((txs ?? []).length !== transactionIds.length) {
        return NextResponse.json({ error: "Une ou plusieurs transactions sont introuvables." }, { status: 404 });
      }

      for (const tx of (txs ?? [])) {
        if (tx.workflow_status !== "reviewed") {
          return NextResponse.json({ error: `La transaction ${tx.id} doit être vérifiée avant comptabilisation.` }, { status: 409 });
        }
        if (tx.vat_status === "pending_evidence") {
          return NextResponse.json({ error: `Le traitement TVA de la transaction ${tx.id} reste à décider.` }, { status: 409 });
        }
        const accountOverride = tx.counterpart_account;
        if (accountOverrides[tx.id] && accountOverrides[tx.id] !== accountOverride) {
          return NextResponse.json({ error: `Le compte de la transaction ${tx.id} a changé depuis sa validation.` }, { status: 409 });
        }
        const allowedCounterpartClasses = tx.type === "income" ? [3, 4, 7] : [2, 4, 6];
        if (!accountOverride || !isValidAccountingAccountCode(accountOverride, allowedCounterpartClasses)) {
          return NextResponse.json({ error: `Compte comptable invalide pour la transaction ${tx.id}` }, { status: 400 });
        }
        const mois = Number(String(tx.date).slice(5, 7));
        const annee = Number(String(tx.date).slice(0, 4));
        if (mois && annee) {
          const locked = await enforcePeriodLock(mois, annee, companyId, dossierId ?? null);
          if (locked) return locked;
        }
        const signed = tx.type === "income" ? Number(tx.amount) : -Number(tx.amount);
        await bookBankTransaction(supabase, {
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: signed,
          category: tx.category,
          invoice_id: tx.invoice_id ?? null,
          counterpart_account: accountOverride ?? null,
          vat_status: tx.vat_status,
          tax_amount: tx.tax_amount,
        }, companyId, dossierId ?? null, accountingSettings as Partial<AccountingSettings> | null);

        const { error: postedError } = await supabase
          .from("transactions")
          .update({
            workflow_status: "posted",
            posted_by: user.id,
            posted_at: new Date().toISOString(),
          })
          .eq("id", tx.id)
          .eq("workflow_status", "reviewed");
        if (postedError) throw postedError;
      }

      await logAudit({
        userId: user.id,
        userEmail: user.email ?? null,
        companyId,
        dossierId: dossierId ?? null,
        action: "POST",
        entityType: "transaction",
        entityLabel: `${txs?.length ?? 0} transaction(s)`,
        newValues: { transactionIds, accountOverrides },
        ...getRequestMeta(req),
      });
      await logAccountingEvent({
        companyId,
        dossierId: dossierId ?? null,
        eventType: "JOURNAL_ENTRY_CREATED",
        triggeredBy: user.id,
        triggeredByEmail: user.email ?? null,
        entityType: "transaction",
        amount: (txs ?? []).reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0),
        eventData: { source: "accounting/book", transactionIds, accountOverrides },
      });
      return NextResponse.json({ ok: true });
    }

    // ── Purchase booking ──────────────────────────────────────────────────────
    if (type === "purchase") {
      const { receiptId, confirmedOcr } = body as { receiptId: string; confirmedOcr?: Record<string, unknown> };
      if (!receiptId || !confirmedOcr || Array.isArray(confirmedOcr) || typeof confirmedOcr !== "object") {
        return NextResponse.json({ error: "Confirmation et données vérifiées requises" }, { status: 400 });
      }
      let receiptQuery = supabase
        .from("receipts")
        .select("id, user_id, status, control_status, approval_status, document_area, ocr_data, created_at")
        .eq("id", receiptId)
        .eq("user_id", ownerId);
      receiptQuery = dossierId ? receiptQuery.eq("dossier_id", dossierId) : receiptQuery.is("dossier_id", null);
      const { data: receipt } = await receiptQuery.single();

      if (!receipt) return NextResponse.json({ error: "Reçu introuvable" }, { status: 404 });
      if (receipt.status === "matched") {
        const { data: existingBatch } = await supabase.from("accounting_booking_batches")
          .select("id")
          .eq("source_type", "purchase")
          .eq("source_id", receiptId)
          .limit(1);
        if (existingBatch?.length) return NextResponse.json({ ok: true, alreadyBooked: true });
      }
      if (receipt.status !== "pending" || receipt.control_status !== "review") {
        return NextResponse.json({ error: "Le document doit être en attente de vérification." }, { status: 409 });
      }
      if (!["not_requested", "approved"].includes(receipt.approval_status)) {
        return NextResponse.json({ error: "La validation du document est encore nécessaire." }, { status: 409 });
      }
      if (!["invoice", "receipt"].includes(String(confirmedOcr.document_type ?? ""))
        || (receipt.document_area !== "supporting_document" && confirmedOcr.is_supplier_invoice === false)
        || (receipt.document_area !== "supporting_document" && receipt.ocr_data?.is_supplier_invoice === false)
        || (!["invoice", "receipt"].includes(String(receipt.ocr_data?.document_type ?? "")) && receipt.ocr_data?.document_type != null)) {
        return NextResponse.json({ error: "Ce document n’est pas une facture ou un reçu fournisseur." }, { status: 409 });
      }
      let priorQuery = supabase.from("receipts")
        .select("id, ocr_data, created_at")
        .eq("user_id", ownerId)
        .neq("id", receiptId)
        .lt("created_at", receipt.created_at)
        .order("created_at", { ascending: false })
        .limit(250);
      priorQuery = dossierId ? priorQuery.eq("dossier_id", dossierId) : priorQuery.is("dossier_id", null);
      const { data: priorDocuments, error: priorError } = await priorQuery;
      if (priorError) throw priorError;
      const checks = evaluateInvoiceControls(confirmedOcr, priorDocuments ?? []);
      if (checks.some(check => check.severity === "critical")) {
        return NextResponse.json({ error: "Anomalie bloquante", message: checks.filter(check => check.severity === "critical").map(check => check.message).join(" ") }, { status: 409 });
      }

      const ocr = confirmedOcr;
      const { totalTtc, totalHt, tvaAmount, discountAmount, commercialDiscountAmount, settlementDiscountAmount } = computePurchaseAmounts(ocr);
      const date     = ocr.date ?? receipt.created_at?.split("T")[0] ?? new Date().toISOString().split("T")[0];
      const confirmedExpenseAccount = typeof ocr.compte === "string" && ocr.compte ? ocr.compte : null;
      if (totalTtc <= 0 || totalHt <= 0 || !Number.isFinite(Number(ocr.amount_ht))) {
        return NextResponse.json({ error: "Montant de la note de frais invalide" }, { status: 400 });
      }
      if (!confirmedExpenseAccount || !isValidAccountingAccountCode(confirmedExpenseAccount, [2, 6])) {
        return NextResponse.json({ error: "Compte de charge invalide" }, { status: 400 });
      }

      const mois = Number(String(date).slice(5, 7));
      const annee = Number(String(date).slice(0, 4));
      if (mois && annee) {
        const locked = await enforcePeriodLock(mois, annee, companyId, dossierId ?? null);
        if (locked) return locked;
      }

      await bookPurchaseInvoice(supabase, {
        id: receipt.id,
        date,
        description: String(ocr.vendor_name ?? ocr.vendor ?? ocr.description ?? "Achat"),
        total_ht: totalHt,
        total_ttc: totalTtc,
        tva_amount: tvaAmount,
        discount_amount: discountAmount,
        commercial_discount_amount: commercialDiscountAmount,
        settlement_discount_amount: settlementDiscountAmount,
        category: ocr.category == null ? null : String(ocr.category),
        expense_account: confirmedExpenseAccount,
        supplier_name: ocr.vendor_name == null && ocr.vendor == null ? null : String(ocr.vendor_name ?? ocr.vendor),
        reference: ocr.receipt_number == null ? null : String(ocr.receipt_number),
      }, companyId, dossierId ?? null, accountingSettings as Partial<AccountingSettings> | null, {
        finalizeReceiptPurchase: true,
        confirmedOcr: ocr,
      });

      await logAudit({
        userId: user.id,
        userEmail: user.email ?? null,
        companyId,
        dossierId: dossierId ?? null,
        action: "CREATE",
        entityType: "ecriture_comptable",
        entityId: receipt.id,
        entityLabel: String(ocr.vendor ?? ocr.description ?? "Achat"),
        newValues: { receipt, total_ht: totalHt, total_ttc: totalTtc, tva_amount: tvaAmount, discount_amount: discountAmount },
        ...getRequestMeta(req),
      });
      await logAccountingEvent({
        companyId,
        dossierId: dossierId ?? null,
        eventType: "PURCHASE_RECORDED",
        triggeredBy: user.id,
        triggeredByEmail: user.email ?? null,
        entityType: "receipt",
        entityId: receipt.id,
        amount: totalTtc,
        periodMois: date ? Number(String(date).slice(5, 7)) : null,
        periodAnnee: date ? Number(String(date).slice(0, 4)) : null,
        eventData: { source: "accounting/book", receipt, ocr },
      });
      return NextResponse.json({ ok: true });
    }

    // ── Avoir client booking ──────────────────────────────────────────────────
    if (type === "avoir") {
      const { invoiceId, finalizeDraft } = body as { invoiceId: string; finalizeDraft?: boolean };
      let avoirQuery = supabase
        .from("invoices")
        .select("id, invoice_number, invoice_type, status, issue_date, total, subtotal, tax_amount, tax_rate, items, clients(name)")
        .eq("id", invoiceId);
      avoirQuery = dossierId ? avoirQuery.eq("dossier_id", dossierId) : avoirQuery.is("dossier_id", null);
      const { data: inv } = await avoirQuery.single();

      if (!inv) return NextResponse.json({ error: "Avoir introuvable" }, { status: 404 });
      if (inv.invoice_type !== "avoir_client") {
        return NextResponse.json({ error: "credit_note_type_required", message: "Le document n’est pas un avoir client." }, { status: 409 });
      }

      const isDraftFinalization = inv.status === "draft" && finalizeDraft === true;
      if (inv.status === "draft" && !isDraftFinalization) {
        return NextResponse.json({ error: "credit_note_not_finalized", message: "Un brouillon d’avoir ne peut pas être comptabilisé." }, { status: 409 });
      }
      if (inv.status === "cancelled") {
        return NextResponse.json({ error: "credit_note_cancelled", message: "Un avoir annulé ne peut pas être comptabilisé." }, { status: 409 });
      }

      const creditMonth = Number(String(inv.issue_date).slice(5, 7));
      const creditYear = Number(String(inv.issue_date).slice(0, 4));
      const locked = await enforcePeriodLock(creditMonth, creditYear, companyId, dossierId ?? null);
      if (locked) return locked;

      await bookAvoirClient(supabase, {
        id: inv.id,
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date,
        total: Number(inv.total),
        subtotal: Number(inv.subtotal),
        tax_amount: Number(inv.tax_amount),
        items: (inv.items ?? []) as any[],
        clients: (inv as any).clients,
      }, companyId, dossierId ?? null, accountingSettings as Partial<AccountingSettings> | null, {
        finalizeDraftCreditNote: isDraftFinalization,
      });

      await logAudit({
        userId: user.id,
        userEmail: user.email ?? null,
        companyId,
        dossierId: dossierId ?? null,
        action: "CREATE",
        entityType: "ecriture_comptable",
        entityId: inv.id,
        entityLabel: inv.invoice_number,
        newValues: inv as any,
        ...getRequestMeta(req),
      });
      await logAccountingEvent({
        companyId,
        dossierId: dossierId ?? null,
        eventType: "JOURNAL_ENTRY_CREATED",
        triggeredBy: user.id,
        triggeredByEmail: user.email ?? null,
        entityType: "avoir",
        entityId: inv.id,
        amount: Number(inv.total),
        periodMois: inv.issue_date ? Number(String(inv.issue_date).slice(5, 7)) : null,
        periodAnnee: inv.issue_date ? Number(String(inv.issue_date).slice(0, 4)) : null,
        eventData: { source: "accounting/book", avoir: inv },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  } catch (err: any) {
    console.error("[accounting/book]", err);
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}

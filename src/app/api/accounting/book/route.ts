import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookSalesInvoice, bookPurchaseInvoice, bookBankTransaction, bookAvoirClient } from "@/lib/accounting-engine";
import { authorizePermission } from "@/lib/api-permissions";
import { logAccountingEvent, logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { requirePlanFeature } from "@/lib/api-plan";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { enforcePeriodLock } from "@/lib/period-check";
import { computePurchaseAmounts } from "@/lib/purchase-booking";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { type, dossierId } = body as {
      type: "invoice" | "bank" | "purchase" | "avoir";
      dossierId?: string;
    };
    if (type === "avoir") {
      const plan = await requirePlanFeature("avoirs");
      if (plan.response) return plan.response;
    }
    const permission = await authorizePermission("accounting", "create", { dossierId });
    if (permission.response) return permission.response;
    const ownerId = await resolveAccountOwnerId(user.id);

    // Resolve company_id when not in dossier context
    let companyId: string | null = null;
    if (dossierId) {
      const { data: dossier } = await supabase
        .from("dossiers")
        .select("id")
        .eq("id", dossierId)
        .eq("fiduciaire_user_id", ownerId)
        .single();
      if (!dossier) {
        return NextResponse.json({ error: "Dossier introuvable" }, { status: 404 });
      }
    } else {
      const { data: co } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", ownerId)
        .single();
      companyId = co?.id ?? null;
      if (!companyId) {
        return NextResponse.json({ error: "Aucune société trouvée" }, { status: 400 });
      }
    }

    // ── Invoice booking ────────────────────────────────────────────────────────
    if (type === "invoice") {
      const { invoiceId } = body as { invoiceId: string };
      let invoiceQuery = supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, total, subtotal, tax_amount, tax_rate, items, clients(name)")
        .eq("id", invoiceId);
      invoiceQuery = dossierId ? invoiceQuery.eq("dossier_id", dossierId) : invoiceQuery.is("dossier_id", null);
      const { data: inv } = await invoiceQuery.single();

      if (!inv) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });

      await bookSalesInvoice(supabase, {
        id: inv.id,
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date,
        total: Number(inv.total),
        subtotal: Number(inv.subtotal),
        tax_amount: Number(inv.tax_amount),
        items: (inv.items ?? []) as any[],
        clients: (inv as any).clients,
      }, companyId, dossierId ?? null);

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

    // ── Bank transaction booking ───────────────────────────────────────────────
    if (type === "bank") {
      const { transactionIds } = body as { transactionIds: string[] };
      if (!transactionIds?.length) {
        return NextResponse.json({ error: "transactionIds requis" }, { status: 400 });
      }

      let transactionsQuery = supabase
        .from("transactions")
        .select("id, date, description, amount, type, category, invoice_id")
        .in("id", transactionIds);
      transactionsQuery = dossierId ? transactionsQuery.eq("dossier_id", dossierId) : transactionsQuery.is("dossier_id", null);
      const { data: txs } = await transactionsQuery;

      for (const tx of (txs ?? [])) {
        const signed = tx.type === "income" ? Number(tx.amount) : -Number(tx.amount);
        await bookBankTransaction(supabase, {
          id: tx.id,
          date: tx.date,
          description: tx.description,
          amount: signed,
          category: tx.category,
          invoice_id: tx.invoice_id ?? null,
        }, companyId, dossierId ?? null);
      }

      await logAudit({
        userId: user.id,
        userEmail: user.email ?? null,
        companyId,
        dossierId: dossierId ?? null,
        action: "IMPORT",
        entityType: "transaction",
        entityLabel: `${txs?.length ?? 0} transaction(s)`,
        newValues: { transactionIds },
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
        eventData: { source: "accounting/book", transactionIds },
      });
      return NextResponse.json({ ok: true });
    }

    // ── Purchase booking ──────────────────────────────────────────────────────
    if (type === "purchase") {
      const { receiptId } = body as { receiptId: string };
      let receiptQuery = supabase
        .from("receipts")
        .select("id, ocr_data, created_at")
        .eq("id", receiptId);
      receiptQuery = dossierId ? receiptQuery.eq("dossier_id", dossierId) : receiptQuery.is("dossier_id", null);
      const { data: receipt } = await receiptQuery.single();

      if (!receipt) return NextResponse.json({ error: "Reçu introuvable" }, { status: 404 });

      const ocr = receipt.ocr_data ?? {};
      const { totalTtc, totalHt, tvaAmount } = computePurchaseAmounts(ocr);
      const date     = ocr.date ?? receipt.created_at?.split("T")[0] ?? new Date().toISOString().split("T")[0];
      if (totalTtc <= 0) {
        return NextResponse.json({ error: "Montant du justificatif invalide" }, { status: 400 });
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
        description: ocr.vendor_name ?? ocr.vendor ?? ocr.description ?? "Achat",
        total_ht: totalHt,
        total_ttc: totalTtc,
        tva_amount: tvaAmount,
        category: ocr.category ?? null,
        expense_account: ocr.compte ?? null,
        supplier_name: ocr.vendor_name ?? ocr.vendor ?? null,
        reference: ocr.receipt_number ?? null,
      }, companyId, dossierId ?? null);

      await logAudit({
        userId: user.id,
        userEmail: user.email ?? null,
        companyId,
        dossierId: dossierId ?? null,
        action: "CREATE",
        entityType: "ecriture_comptable",
        entityId: receipt.id,
        entityLabel: ocr.vendor ?? ocr.description ?? "Achat",
        newValues: { receipt, total_ht: totalHt, total_ttc: totalTtc, tva_amount: tvaAmount },
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
      const { invoiceId } = body as { invoiceId: string };
      let avoirQuery = supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, total, subtotal, tax_amount, tax_rate, items, clients(name)")
        .eq("id", invoiceId);
      avoirQuery = dossierId ? avoirQuery.eq("dossier_id", dossierId) : avoirQuery.is("dossier_id", null);
      const { data: inv } = await avoirQuery.single();

      if (!inv) return NextResponse.json({ error: "Avoir introuvable" }, { status: 404 });

      await bookAvoirClient(supabase, {
        id: inv.id,
        invoice_number: inv.invoice_number,
        issue_date: inv.issue_date,
        total: Number(inv.total),
        subtotal: Number(inv.subtotal),
        tax_amount: Number(inv.tax_amount),
        items: (inv.items ?? []) as any[],
        clients: (inv as any).clients,
      }, companyId, dossierId ?? null);

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

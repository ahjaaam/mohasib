import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";
import { createVersion, getDiff, logAccountingEvent, logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { enforcePeriodLock } from "@/lib/period-check";
import { resolveAccountOwnerId } from "@/lib/account-owner";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const ownerId = await resolveAccountOwnerId(user.id);

    const body = await req.json();
    const {
      invoice_id,
      inbox_item_id,
      montant,
      date_paiement,
      mode_paiement,
      reference,
      notes,
      payment_type,
    } = body;

    if (!montant || Number(montant) <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }
    if (!date_paiement) {
      return NextResponse.json({ error: "Date de paiement requise" }, { status: 400 });
    }
    if (!invoice_id && !inbox_item_id) {
      return NextResponse.json({ error: "invoice_id ou inbox_item_id requis" }, { status: 400 });
    }
    if (invoice_id && inbox_item_id) {
      return NextResponse.json({ error: "Un seul document peut être payé à la fois" }, { status: 400 });
    }

    const { data: invoice } = invoice_id
      ? await supabase.from("invoices").select("id,invoice_number,total,montant_recu,montant_paye,status,dossier_id").eq("id", invoice_id).single()
      : { data: null };
    const { data: receipt } = inbox_item_id
      ? await supabase.from("receipts").select("id,ocr_data,dossier_id").eq("id", inbox_item_id).single()
      : { data: null };
    if (invoice_id && !invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    if (inbox_item_id && !receipt) return NextResponse.json({ error: "Document fournisseur introuvable" }, { status: 404 });
    const amount = Number(montant);
    const currentInvoicePaid = invoice
      ? Math.max(Number(invoice.montant_recu ?? 0), Number(invoice.montant_paye ?? 0))
      : 0;
    if (invoice && currentInvoicePaid + amount > Number(invoice.total) + 0.01) {
      return NextResponse.json({ error: "Le paiement dépasse le solde de la facture" }, { status: 400 });
    }
    if (receipt) {
      const paid = Number(receipt.ocr_data?.montant_paye ?? 0);
      const total = Math.abs(Number(receipt.ocr_data?.amount ?? 0));
      if (total > 0 && paid + amount > total + 0.01) {
        return NextResponse.json({ error: "Le paiement dépasse le solde fournisseur" }, { status: 400 });
      }
    }

    const dossierId = invoice?.dossier_id ?? receipt?.dossier_id ?? null;
    const permission = await authorizePermission("accounting", "create", { dossierId });
    if (permission.response) return permission.response;
    const { data: company } = dossierId
      ? { data: null }
      : await supabase.from("companies").select("id").eq("user_id", ownerId).single();
    const mois = Number(String(date_paiement).slice(5, 7));
    const annee = Number(String(date_paiement).slice(0, 4));
    if (mois && annee) {
      const locked = await enforcePeriodLock(mois, annee, company?.id ?? null, dossierId);
      if (locked) return locked;
    }

    let payment: Record<string, unknown> | null = null;

    // Client invoice settlement is one database transaction: evidence first,
    // then the derived paid amount and status.
    if (invoice_id) {
      if (invoice) {
        const { data: recorded, error: paymentError } = await supabase.rpc("record_invoice_payment", {
          p_invoice_id: invoice_id,
          p_amount: amount,
          p_payment_date: date_paiement,
          p_payment_method: mode_paiement ?? null,
          p_reference: reference ?? null,
          p_notes: notes ?? null,
        });
        if (paymentError) {
          const paymentErrors: Record<string, string> = {
            draft_invoice_must_be_finalized: "La facture doit être finalisée avant d’enregistrer un paiement",
            cancelled_invoice_cannot_be_paid: "Une facture annulée ne peut pas être payée",
            payment_exceeds_invoice_balance: "Le paiement dépasse le solde de la facture",
            payment_requires_client_invoice: "Le paiement doit concerner une facture client",
          };
          const translated = Object.entries(paymentErrors).find(([code]) => paymentError.message.includes(code))?.[1];
          return NextResponse.json({ error: translated ?? paymentError.message }, { status: 400 });
        }

        const result = (recorded ?? {}) as {
          payment?: Record<string, unknown>;
          invoice?: { montant_recu?: number; montant_paye?: number; reste_a_payer?: number; status?: string };
        };
        payment = result.payment ?? null;
        const newMontantRecu = Number(result.invoice?.montant_recu ?? currentInvoicePaid + amount);
        const nextStatus = result.invoice?.status
          ?? (newMontantRecu >= Number(invoice.total) - 0.01 ? "paid" : "partiellement_payee");
        const isPaid = nextStatus === "paid";

        const updatedInvoice = {
          ...invoice,
          montant_recu: newMontantRecu,
          montant_paye: Number(result.invoice?.montant_paye ?? newMontantRecu),
          reste_a_payer: Number(result.invoice?.reste_a_payer ?? Math.max(Number(invoice.total) - newMontantRecu, 0)),
          status: nextStatus,
          payment_method: mode_paiement ?? null,
          payment_reference: reference ?? null,
        };
        await createVersion(
          "invoice",
          invoice_id,
          updatedInvoice as any,
          user.id,
          user.email ?? null,
          "STATUS_CHANGE",
          "Paiement enregistré",
          getDiff(invoice as any, updatedInvoice as any),
        );
        await logAudit({
          userId: user.id,
          userEmail: user.email ?? null,
          companyId: company?.id ?? null,
          dossierId,
          action: "MARK_PAID",
          entityType: "invoice",
          entityId: invoice_id,
          entityLabel: invoice.invoice_number ?? invoice_id,
          oldValues: invoice as any,
          newValues: updatedInvoice as any,
          changedFields: Object.keys(getDiff(invoice as any, updatedInvoice as any)),
          ...getRequestMeta(req),
        });
        await logAccountingEvent({
          companyId: company?.id ?? null,
          dossierId,
          eventType: isPaid ? "INVOICE_PAID" : "PAYMENT_MADE",
          triggeredBy: user.id,
          triggeredByEmail: user.email ?? null,
          entityType: "invoice",
          entityId: invoice_id,
          amount,
          periodMois: date_paiement ? Number(String(date_paiement).slice(5, 7)) : null,
          periodAnnee: date_paiement ? Number(String(date_paiement).slice(0, 4)) : null,
          eventData: { payment, invoice: updatedInvoice },
        });
      }
    }

    // Supplier-document settlement keeps its existing allocation path.
    if (inbox_item_id) {
      if (receipt) {
        const { data: insertedPayment, error: payErr } = await supabase
          .from("invoice_payments")
          .insert({
            invoice_id: null,
            inbox_item_id,
            company_id: company?.id ?? null,
            dossier_id: dossierId,
            montant: amount,
            date_paiement,
            mode_paiement: mode_paiement ?? null,
            reference: reference ?? null,
            notes: notes ?? null,
            payment_type: payment_type ?? "decaissement",
            allocation_status: "confirmed",
            match_confidence: 1,
            match_method: "manual_payment_entry",
            confirmed_by: user.id,
            confirmed_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (payErr) throw new Error(payErr.message);
        payment = insertedPayment;

        const currentPaid = Number(receipt.ocr_data?.montant_paye ?? 0);
        const newPaid = currentPaid + amount;
        const total = Math.abs(Number(receipt.ocr_data?.amount ?? 0));
        const isPaid = newPaid >= total - 0.01;

        const { error: receiptUpdateError } = await supabase.from("receipts").update({
          ocr_data: {
            ...receipt.ocr_data,
            montant_paye: newPaid,
            payment_status: isPaid ? "paid" : "partial",
          },
        }).eq("id", inbox_item_id);
        if (receiptUpdateError) throw receiptUpdateError;

        await logAudit({
          userId: user.id,
          userEmail: user.email ?? null,
          companyId: company?.id ?? null,
          dossierId,
          action: "MARK_PAID",
          entityType: "inbox_item",
          entityId: inbox_item_id,
          entityLabel: receipt.ocr_data?.vendor_name ?? receipt.ocr_data?.vendor ?? "Document fournisseur",
          oldValues: receipt as any,
          newValues: {
            ...receipt,
            ocr_data: { ...receipt.ocr_data, montant_paye: newPaid, payment_status: isPaid ? "paid" : "partial" },
          } as any,
          changedFields: ["ocr_data"],
          ...getRequestMeta(req),
        });
        await logAccountingEvent({
          companyId: company?.id ?? null,
          dossierId,
          eventType: "PAYMENT_MADE",
          triggeredBy: user.id,
          triggeredByEmail: user.email ?? null,
          entityType: "inbox_item",
          entityId: inbox_item_id,
          amount,
          periodMois: date_paiement ? Number(String(date_paiement).slice(5, 7)) : null,
          periodAnnee: date_paiement ? Number(String(date_paiement).slice(0, 4)) : null,
          eventData: { payment, receipt_id: receipt.id, ocr_data: receipt.ocr_data },
        });

      }
    }

    return NextResponse.json({ success: true, payment });
  } catch (err: any) {
    console.error("[invoice-payments POST]", err);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}

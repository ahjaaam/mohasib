import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";
import { createVersion, getDiff, logAccountingEvent, logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { enforcePeriodLock } from "@/lib/period-check";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      ? await supabase.from("invoices").select("id,invoice_number,total,montant_recu,status,dossier_id").eq("id", invoice_id).single()
      : { data: null };
    const { data: receipt } = inbox_item_id
      ? await supabase.from("receipts").select("id,ocr_data,dossier_id").eq("id", inbox_item_id).single()
      : { data: null };
    if (invoice_id && !invoice) return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
    if (inbox_item_id && !receipt) return NextResponse.json({ error: "Document fournisseur introuvable" }, { status: 404 });
    const amount = Number(montant);
    if (invoice && Number(invoice.montant_recu ?? 0) + amount > Number(invoice.total) + 0.01) {
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
      : await supabase.from("companies").select("id").eq("user_id", user.id).single();
    const mois = Number(String(date_paiement).slice(5, 7));
    const annee = Number(String(date_paiement).slice(0, 4));
    if (mois && annee) {
      const locked = await enforcePeriodLock(mois, annee, company?.id ?? null, dossierId);
      if (locked) return locked;
    }

    // 1. Insert into invoice_payments
    const { data: payment, error: payErr } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id: invoice_id ?? null,
        inbox_item_id: inbox_item_id ?? null,
        company_id: company?.id ?? null,
        dossier_id: dossierId,
        montant: amount,
        date_paiement,
        mode_paiement: mode_paiement ?? null,
        reference: reference ?? null,
        notes: notes ?? null,
        payment_type: payment_type ?? "encaissement",
      })
      .select()
      .single();

    if (payErr) throw new Error(payErr.message);

    // 2a. Update client invoice
    if (invoice_id) {
      if (invoice) {
        const newMontantRecu = Number(invoice.montant_recu ?? 0) + amount;
        const isPaid = newMontantRecu >= Number(invoice.total) - 0.01;
        const { error: invoiceUpdateError } = await supabase.from("invoices").update({
          montant_recu: newMontantRecu,
          status: isPaid ? "paid" : "partiellement_payee",
          payment_method: mode_paiement ?? null,
          payment_reference: reference ?? null,
        }).eq("id", invoice_id);
        if (invoiceUpdateError) throw invoiceUpdateError;

        const updatedInvoice = {
          ...invoice,
          montant_recu: newMontantRecu,
          status: isPaid ? "paid" : "partiellement_payee",
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

        if (payment_type === "encaissement") {
          const { error: transactionError } = await supabase.from("transactions").insert({
            user_id: user.id,
            type: "income",
            description: `Encaissement — paiement reçu`,
            amount,
            date: date_paiement,
            payment_method: mode_paiement ?? null,
            reference: reference ?? null,
            notes: notes ?? null,
            invoice_id,
            dossier_id: dossierId,
          });
          if (transactionError) throw transactionError;
        }
      }
    }

    // 2b. Update supplier receipt ocr_data
    if (inbox_item_id) {
      if (receipt) {
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

        const { error: transactionError } = await supabase.from("transactions").insert({
          user_id: user.id,
          type: "expense",
          description: `Paiement fournisseur${receipt.ocr_data?.vendor_name ? ` — ${receipt.ocr_data.vendor_name}` : ""}`,
          amount,
          date: date_paiement,
          payment_method: mode_paiement ?? null,
          reference: reference ?? null,
          notes: notes ?? null,
          dossier_id: dossierId,
        });
        if (transactionError) throw transactionError;
      }
    }

    return NextResponse.json({ success: true, payment });
  } catch (err: any) {
    console.error("[invoice-payments POST]", err);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}

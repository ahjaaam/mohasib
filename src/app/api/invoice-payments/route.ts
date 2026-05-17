import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
      invoice_id,
      inbox_item_id,
      company_id,
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
    if (!invoice_id && !inbox_item_id) {
      return NextResponse.json({ error: "invoice_id ou inbox_item_id requis" }, { status: 400 });
    }

    // 1. Insert into invoice_payments
    const { data: payment, error: payErr } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id: invoice_id ?? null,
        inbox_item_id: inbox_item_id ?? null,
        company_id: company_id ?? null,
        montant: Number(montant),
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
      const { data: inv } = await supabase
        .from("invoices")
        .select("total, montant_recu, status")
        .eq("id", invoice_id)
        .eq("user_id", user.id)
        .single();

      if (inv) {
        const newMontantRecu = Number(inv.montant_recu ?? 0) + Number(montant);
        const isPaid = newMontantRecu >= Number(inv.total) - 0.01;
        await supabase.from("invoices").update({
          montant_recu: newMontantRecu,
          status: isPaid ? "paid" : "partiellement_payee",
          payment_method: mode_paiement ?? null,
          payment_reference: reference ?? null,
        }).eq("id", invoice_id);

        // Fire-and-forget accounting entry
        if (payment_type === "encaissement") {
          void supabase.from("transactions").insert({
            user_id: user.id,
            type: "income",
            description: `Encaissement — paiement reçu`,
            amount: Number(montant),
            date: date_paiement,
            payment_method: mode_paiement ?? null,
            reference: reference ?? null,
            notes: notes ?? null,
            invoice_id,
          });
        }
      }
    }

    // 2b. Update supplier receipt ocr_data
    if (inbox_item_id) {
      const { data: receipt } = await supabase
        .from("receipts")
        .select("ocr_data")
        .eq("id", inbox_item_id)
        .eq("user_id", user.id)
        .single();

      if (receipt) {
        const currentPaid = Number(receipt.ocr_data?.montant_paye ?? 0);
        const newPaid = currentPaid + Number(montant);
        const total = Math.abs(Number(receipt.ocr_data?.amount ?? 0));
        const isPaid = newPaid >= total - 0.01;

        await supabase.from("receipts").update({
          ocr_data: {
            ...receipt.ocr_data,
            montant_paye: newPaid,
            payment_status: isPaid ? "paid" : "partial",
          },
        }).eq("id", inbox_item_id);

        // Fire-and-forget accounting entry (décaissement)
        void supabase.from("transactions").insert({
          user_id: user.id,
          type: "expense",
          description: `Paiement fournisseur${receipt.ocr_data?.vendor_name ? ` — ${receipt.ocr_data.vendor_name}` : ""}`,
          amount: Number(montant),
          date: date_paiement,
          payment_method: mode_paiement ?? null,
          reference: reference ?? null,
          notes: notes ?? null,
        });
      }
    }

    return NextResponse.json({ success: true, payment });
  } catch (err: any) {
    console.error("[invoice-payments POST]", err);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}

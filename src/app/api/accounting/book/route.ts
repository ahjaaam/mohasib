import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bookSalesInvoice, bookPurchaseInvoice, bookBankTransaction, bookAvoirClient } from "@/lib/accounting-engine";
import { autoLettrage } from "@/lib/lettrage";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { type, dossierId } = body as {
      type: "invoice" | "bank" | "purchase";
      dossierId?: string;
    };

    // Resolve company_id when not in dossier context
    let companyId: string | null = null;
    if (!dossierId) {
      const { data: co } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .single();
      companyId = co?.id ?? null;
      if (!companyId) {
        return NextResponse.json({ error: "Aucune société trouvée" }, { status: 400 });
      }
    }

    // ── Invoice booking ────────────────────────────────────────────────────────
    if (type === "invoice") {
      const { invoiceId } = body as { invoiceId: string };
      const { data: inv } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, total, subtotal, tax_amount, tax_rate, items, clients(name)")
        .eq("id", invoiceId)
        .single();

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

      await autoLettrage(supabase, companyId, dossierId ?? null);
      return NextResponse.json({ ok: true });
    }

    // ── Bank transaction booking ───────────────────────────────────────────────
    if (type === "bank") {
      const { transactionIds } = body as { transactionIds: string[] };
      if (!transactionIds?.length) {
        return NextResponse.json({ error: "transactionIds requis" }, { status: 400 });
      }

      const { data: txs } = await supabase
        .from("transactions")
        .select("id, date, description, amount, type, category, invoice_id")
        .in("id", transactionIds);

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

      await autoLettrage(supabase, companyId, dossierId ?? null);
      return NextResponse.json({ ok: true });
    }

    // ── Purchase booking ──────────────────────────────────────────────────────
    if (type === "purchase") {
      const { receiptId } = body as { receiptId: string };
      const { data: receipt } = await supabase
        .from("receipts")
        .select("id, ocr_data, created_at")
        .eq("id", receiptId)
        .single();

      if (!receipt) return NextResponse.json({ error: "Reçu introuvable" }, { status: 404 });

      const ocr = receipt.ocr_data ?? {};
      const totalTtc = Math.abs(Number(ocr.amount ?? 0));
      const tvaAmt   = Math.abs(Number(ocr.tva_amount ?? 0));
      const totalHt  = totalTtc - tvaAmt;
      const date     = ocr.date ?? receipt.created_at?.split("T")[0] ?? new Date().toISOString().split("T")[0];

      await bookPurchaseInvoice(supabase, {
        id: receipt.id,
        date,
        description: ocr.vendor ?? ocr.description ?? "Achat",
        total_ht: totalHt,
        total_ttc: totalTtc,
        tva_amount: tvaAmt,
        category: ocr.category ?? null,
        supplier_name: ocr.vendor ?? ocr.vendor_name ?? null,
        reference: ocr.receipt_number ?? null,
      }, companyId, dossierId ?? null);

      await autoLettrage(supabase, companyId, dossierId ?? null);
      return NextResponse.json({ ok: true });
    }

    // ── Avoir client booking ──────────────────────────────────────────────────
    if (type === "avoir") {
      const { invoiceId } = body as { invoiceId: string };
      const { data: inv } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, total, subtotal, tax_amount, tax_rate, items, clients(name)")
        .eq("id", invoiceId)
        .single();

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

      await autoLettrage(supabase, companyId, dossierId ?? null);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  } catch (err: any) {
    console.error("[accounting/book]", err);
    return NextResponse.json({ error: err.message ?? "Erreur interne" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";

function normalise(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasStrongIdentity(transactionText: string, reference?: string | null, counterparty?: string | null) {
  const normalizedReference = normalise(reference);
  if (normalizedReference.length >= 3 && transactionText.includes(normalizedReference)) return true;

  const normalizedCounterparty = normalise(counterparty);
  const genericNames = new Set(["client", "fournisseur", "facture", "sarl", "sa"]);
  return normalizedCounterparty.length >= 4
    && !genericNames.has(normalizedCounterparty)
    && transactionText.includes(normalizedCounterparty);
}

function sameAmount(a: number, b: number) {
  return Math.abs(a - b) <= 0.01;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const requestedIds = Array.isArray(body.transaction_ids)
      ? [...new Set(body.transaction_ids.map(String))].slice(0, 100)
      : [];
    if (!requestedIds.length) {
      return NextResponse.json({ matched: 0, transaction_ids: [] });
    }

    const { data: transactions, error: transactionError } = await supabase
      .from("transactions")
      .select("id,user_id,dossier_id,type,amount,date,description,reference,bank_reference")
      .in("id", requestedIds);
    if (transactionError) throw transactionError;

    const matchedTransactionIds: string[] = [];
    const authorizedScopes = new Map<string, boolean>();

    for (const transaction of transactions ?? []) {
      const scopeKey = transaction.dossier_id ?? "main";
      if (!authorizedScopes.has(scopeKey)) {
        const permission = await authorizePermission("accounting", "create", {
          dossierId: transaction.dossier_id,
        });
        authorizedScopes.set(scopeKey, !permission.response);
      }
      if (!authorizedScopes.get(scopeKey)) continue;

      const { data: existingRows } = await supabase
        .from("invoice_payments")
        .select("montant")
        .eq("transaction_id", transaction.id)
        .eq("allocation_status", "confirmed");
      const alreadyAllocated = (existingRows ?? []).reduce(
        (sum, allocation) => sum + Number(allocation.montant),
        0,
      );
      const transactionRemaining = Math.max(Math.abs(Number(transaction.amount)) - alreadyAllocated, 0);
      if (transactionRemaining <= 0.009) continue;

      const transactionText = normalise(
        `${transaction.description ?? ""} ${transaction.reference ?? ""} ${transaction.bank_reference ?? ""}`,
      );
      const candidates: Array<{
        document_type: "client_invoice" | "supplier_document";
        document_id: string;
        amount: number;
      }> = [];

      if (transaction.type === "income") {
        let query = supabase
          .from("invoices")
          .select("id,invoice_number,total,montant_recu,status,invoice_type,clients(name)")
          .neq("status", "cancelled")
          .limit(250);
        query = transaction.dossier_id
          ? query.eq("dossier_id", transaction.dossier_id)
          : query.eq("user_id", transaction.user_id).is("dossier_id", null);
        const { data: invoices } = await query;

        for (const invoice of invoices ?? []) {
          if (invoice.invoice_type === "avoir_client") continue;
          const remaining = Math.max(Number(invoice.total) - Number(invoice.montant_recu ?? 0), 0);
          if (!sameAmount(remaining, transactionRemaining)) continue;
          if (!hasStrongIdentity(transactionText, invoice.invoice_number, (invoice.clients as any)?.name)) continue;
          candidates.push({
            document_type: "client_invoice",
            document_id: invoice.id,
            amount: transactionRemaining,
          });
        }
      } else {
        let query = supabase
          .from("receipts")
          .select("id,file_name,ocr_data")
          .limit(250);
        query = transaction.dossier_id
          ? query.eq("dossier_id", transaction.dossier_id)
          : query.eq("user_id", transaction.user_id).is("dossier_id", null);
        const { data: receipts } = await query;

        for (const receipt of receipts ?? []) {
          const total = Math.abs(Number(receipt.ocr_data?.amount ?? 0));
          const paid = Number(receipt.ocr_data?.montant_paye ?? 0);
          const remaining = Math.max(total - paid, 0);
          if (!sameAmount(remaining, transactionRemaining)) continue;
          const reference = receipt.ocr_data?.invoice_number || receipt.ocr_data?.receipt_number;
          const supplier = receipt.ocr_data?.vendor_name || receipt.ocr_data?.vendor;
          if (!hasStrongIdentity(transactionText, reference, supplier)) continue;
          candidates.push({
            document_type: "supplier_document",
            document_id: receipt.id,
            amount: transactionRemaining,
          });
        }
      }

      if (candidates.length !== 1) continue;

      const { error: allocationError } = await supabase.rpc("confirm_payment_allocations", {
        p_transaction_id: transaction.id,
        p_allocations: candidates,
        p_match_method: "automatic_exact",
      });
      if (!allocationError) matchedTransactionIds.push(transaction.id);
    }

    return NextResponse.json({
      matched: matchedTransactionIds.length,
      transaction_ids: matchedTransactionIds,
    });
  } catch (error: any) {
    console.error("[payment-allocations auto-match]", error);
    return NextResponse.json({ error: error.message ?? String(error) }, { status: 500 });
  }
}

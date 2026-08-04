import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { authorizePermission } from "@/lib/api-permissions";
import { logAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";

type AllocationInput = {
  document_type: "client_invoice" | "supplier_document";
  document_id: string;
  amount: number;
};

function normalise(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function daysBetween(a: string, b: string) {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86_400_000;
}

function candidateScore(input: {
  transactionAmount: number;
  transactionDate: string;
  transactionDescription: string;
  transactionReference?: string | null;
  remaining: number;
  documentDate?: string | null;
  documentReference?: string | null;
  counterparty?: string | null;
}) {
  const evidence: string[] = [];
  let score = 0;
  if (Math.abs(input.transactionAmount - input.remaining) <= 0.01) {
    score += 60;
    evidence.push("Montant restant exact");
  }

  const transactionText = normalise(`${input.transactionDescription} ${input.transactionReference ?? ""}`);
  const reference = normalise(input.documentReference);
  if (reference && transactionText.includes(reference)) {
    score += 25;
    evidence.push("Référence trouvée");
  }

  const counterparty = normalise(input.counterparty);
  if (counterparty.length >= 3 && transactionText.includes(counterparty)) {
    score += 20;
    evidence.push("Tiers trouvé");
  }

  if (input.documentDate) {
    const days = daysBetween(input.transactionDate, input.documentDate);
    if (days <= 7) {
      score += 10;
      evidence.push("Date proche");
    } else if (days <= 45) {
      score += 5;
      evidence.push("Date cohérente");
    }
  }

  return { score: Math.min(score, 100), evidence };
}

function scopeQuery(query: any, transaction: { user_id: string; dossier_id: string | null }) {
  return transaction.dossier_id
    ? query.eq("dossier_id", transaction.dossier_id)
    : query.eq("user_id", transaction.user_id).is("dossier_id", null);
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const transactionId = req.nextUrl.searchParams.get("transaction_id");
    if (!transactionId) {
      return NextResponse.json({ error: "transaction_id requis" }, { status: 400 });
    }

    const { data: transaction } = await supabase
      .from("transactions")
      .select("id,user_id,dossier_id,type,amount,date,description,reference,bank_reference")
      .eq("id", transactionId)
      .single();
    if (!transaction) return NextResponse.json({ error: "Transaction introuvable" }, { status: 404 });

    const permission = await authorizePermission("accounting", "create", { dossierId: transaction.dossier_id });
    if (permission.response) return permission.response;

    const { data: allocationRows, error: allocationError } = await supabase
      .from("invoice_payments")
      .select("id,montant,invoice_id,inbox_item_id,allocation_status")
      .eq("transaction_id", transaction.id)
      .eq("allocation_status", "confirmed");
    if (allocationError) throw allocationError;

    const allocations = allocationRows ?? [];
    const invoiceIds = allocations.map(item => item.invoice_id).filter(Boolean) as string[];
    const receiptIds = allocations.map(item => item.inbox_item_id).filter(Boolean) as string[];

    const [allocatedInvoicesResult, allocatedReceiptsResult] = await Promise.all([
      invoiceIds.length
        ? supabase.from("invoices").select("id,invoice_number,clients(name)").in("id", invoiceIds)
        : Promise.resolve({ data: [] as any[] }),
      receiptIds.length
        ? supabase.from("receipts").select("id,file_name,ocr_data").in("id", receiptIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const invoiceLabels = new Map((allocatedInvoicesResult.data ?? []).map((item: any) => [
      item.id,
      `${item.invoice_number}${item.clients?.name ? ` · ${item.clients.name}` : ""}`,
    ]));
    const receiptLabels = new Map((allocatedReceiptsResult.data ?? []).map((item: any) => [
      item.id,
      item.ocr_data?.vendor_name || item.ocr_data?.vendor || item.file_name || "Document fournisseur",
    ]));
    const existingAllocations = allocations.map(item => ({
      id: item.id,
      amount: Number(item.montant),
      document_type: item.invoice_id ? "client_invoice" : "supplier_document",
      document_id: item.invoice_id ?? item.inbox_item_id,
      label: item.invoice_id
        ? invoiceLabels.get(item.invoice_id) ?? "Facture client"
        : receiptLabels.get(item.inbox_item_id) ?? "Document fournisseur",
    }));
    const allocatedTotal = existingAllocations.reduce((sum, item) => sum + item.amount, 0);
    const transactionAmount = Math.abs(Number(transaction.amount));
    const transactionRemaining = Math.max(transactionAmount - allocatedTotal, 0);

    let candidates: any[] = [];
    if (transaction.type === "income") {
      const query = supabase
        .from("invoices")
        .select("id,invoice_number,issue_date,due_date,total,montant_recu,status,invoice_type,clients(name)")
        .order("issue_date", { ascending: false })
        .limit(250);
      const { data, error } = await scopeQuery(query, transaction);
      if (error) throw error;

      candidates = (data ?? [])
        .filter((invoice: any) => invoice.invoice_type !== "avoir_client" && invoice.status !== "cancelled")
        .map((invoice: any) => {
          const remaining = Math.max(Number(invoice.total) - Number(invoice.montant_recu ?? 0), 0);
          const match = candidateScore({
            transactionAmount: transactionRemaining,
            transactionDate: transaction.date,
            transactionDescription: transaction.description,
            transactionReference: transaction.reference ?? transaction.bank_reference,
            remaining,
            documentDate: invoice.due_date ?? invoice.issue_date,
            documentReference: invoice.invoice_number,
            counterparty: invoice.clients?.name,
          });
          return {
            document_type: "client_invoice",
            document_id: invoice.id,
            label: invoice.invoice_number,
            counterparty: invoice.clients?.name ?? "Client",
            document_date: invoice.issue_date,
            total: Number(invoice.total),
            paid: Number(invoice.montant_recu ?? 0),
            remaining,
            ...match,
          };
        })
        .filter((candidate: any) => candidate.remaining > 0.009);
    } else {
      const query = supabase
        .from("receipts")
        .select("id,file_name,ocr_data,created_at")
        .order("created_at", { ascending: false })
        .limit(250);
      const { data, error } = await scopeQuery(query, transaction);
      if (error) throw error;

      candidates = (data ?? [])
        .map((receipt: any) => {
          const total = Math.abs(Number(receipt.ocr_data?.amount ?? 0));
          const paid = Number(receipt.ocr_data?.montant_paye ?? 0);
          const remaining = Math.max(total - paid, 0);
          const vendor = receipt.ocr_data?.vendor_name || receipt.ocr_data?.vendor || "Fournisseur";
          const reference = receipt.ocr_data?.invoice_number || receipt.ocr_data?.receipt_number;
          const match = candidateScore({
            transactionAmount: transactionRemaining,
            transactionDate: transaction.date,
            transactionDescription: transaction.description,
            transactionReference: transaction.reference ?? transaction.bank_reference,
            remaining,
            documentDate: receipt.ocr_data?.due_date || receipt.ocr_data?.date,
            documentReference: reference,
            counterparty: vendor,
          });
          return {
            document_type: "supplier_document",
            document_id: receipt.id,
            label: reference || receipt.file_name || "Document fournisseur",
            counterparty: vendor,
            document_date: receipt.ocr_data?.date ?? receipt.created_at?.slice(0, 10),
            total,
            paid,
            remaining,
            ...match,
          };
        })
        .filter((candidate: any) => candidate.total > 0 && candidate.remaining > 0.009);
    }

    candidates.sort((a, b) => b.score - a.score || b.document_date.localeCompare(a.document_date));

    return NextResponse.json({
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transactionAmount,
        date: transaction.date,
        description: transaction.description,
      },
      allocated_total: allocatedTotal,
      remaining: transactionRemaining,
      allocations: existingAllocations,
      candidates,
    });
  } catch (error: any) {
    console.error("[payment-allocations GET]", error);
    return NextResponse.json({ error: error.message ?? String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const transactionId = String(body.transaction_id ?? "");
    const allocations = Array.isArray(body.allocations) ? body.allocations as AllocationInput[] : [];
    if (!transactionId || allocations.length === 0) {
      return NextResponse.json({ error: "Transaction et affectations requises" }, { status: 400 });
    }
    if (allocations.some(item =>
      !["client_invoice", "supplier_document"].includes(item.document_type)
      || !item.document_id
      || !Number.isFinite(Number(item.amount))
      || Number(item.amount) <= 0
    )) {
      return NextResponse.json({ error: "Affectation invalide" }, { status: 400 });
    }

    const { data: transaction } = await supabase
      .from("transactions")
      .select("id,user_id,dossier_id,type,amount,description")
      .eq("id", transactionId)
      .single();
    if (!transaction) return NextResponse.json({ error: "Transaction introuvable" }, { status: 404 });

    const permission = await authorizePermission("accounting", "create", { dossierId: transaction.dossier_id });
    if (permission.response) return permission.response;

    const { data, error } = await supabase.rpc("confirm_payment_allocations", {
      p_transaction_id: transactionId,
      p_allocations: allocations.map(item => ({
        document_type: item.document_type,
        document_id: item.document_id,
        amount: Number(Number(item.amount).toFixed(2)),
      })),
      p_match_method: "manual",
    });
    if (error) {
      const messages: Record<string, string> = {
        allocation_exceeds_transaction: "Le total affecté dépasse le montant restant de la transaction.",
        allocation_exceeds_document: "Un montant affecté dépasse le solde du document.",
        client_invoice_requires_income: "Une facture client doit être liée à un encaissement.",
        supplier_document_requires_expense: "Une facture fournisseur doit être liée à un décaissement.",
        duplicate_document_allocation: "Le même document ne peut être sélectionné deux fois.",
      };
      const known = Object.keys(messages).find(key => error.message.includes(key));
      return NextResponse.json({ error: known ? messages[known] : error.message }, { status: 400 });
    }

    await logAudit({
      userId: user.id,
      userEmail: user.email ?? null,
      dossierId: transaction.dossier_id,
      action: "ALLOCATE_PAYMENT",
      entityType: "transaction",
      entityId: transaction.id,
      entityLabel: transaction.description,
      newValues: data as any,
      changedFields: ["payment_allocations"],
      ...getRequestMeta(req),
    });

    return NextResponse.json({ success: true, result: data });
  } catch (error: any) {
    console.error("[payment-allocations POST]", error);
    return NextResponse.json({ error: error.message ?? String(error) }, { status: 500 });
  }
}

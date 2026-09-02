import { createClient } from "@/lib/supabase/server";
import { mergeDashboardDeadlines, parseDeadlineDate, type DashboardDeadline } from "@/lib/dashboard-deadlines";
import type { GlobalPeriod } from "@/lib/global-period";

export type AttentionItem = {
  id: string;
  title: string;
  description: string;
  count: number;
  href: string;
  actionLabel: string;
  severity: "critical" | "warning" | "info";
  category: "payments" | "documents" | "bank" | "declarations";
};

function formatMoney(value: number) {
  return `${value.toLocaleString("fr-MA", { maximumFractionDigits: 2 })} MAD`;
}

function supplierTotal(item: any) {
  return Math.abs(Number(item.ocr_data?.amount ?? 0));
}

function supplierPaid(item: any) {
  return Number(item.ocr_data?.montant_paye ?? 0);
}

export async function getAttentionItems(ownerId: string, period: GlobalPeriod): Promise<AttentionItem[]> {
  const supabase = await createClient();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  let invoiceQuery = supabase
    .from("invoices")
    .select("total, due_date, montant_recu")
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .in("status", ["sent", "overdue"]);
  let supplierQuery = supabase
    .from("receipts")
    .select("id, status, ocr_data, created_at")
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .eq("status", "matched");
  let pendingReceiptQuery = supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .eq("status", "pending");
  let bankTransactionQuery = supabase
    .from("transactions")
    .select("id")
    .eq("user_id", ownerId)
    .is("dossier_id", null)
    .eq("source", "bank_import");

  if (period.start && period.end) {
    invoiceQuery = invoiceQuery.gte("issue_date", period.start).lte("issue_date", period.end);
    supplierQuery = supplierQuery.gte("created_at", `${period.start}T00:00:00`).lte("created_at", `${period.end}T23:59:59.999Z`);
    pendingReceiptQuery = pendingReceiptQuery.gte("created_at", `${period.start}T00:00:00`).lte("created_at", `${period.end}T23:59:59.999Z`);
    bankTransactionQuery = bankTransactionQuery.gte("date", period.start).lte("date", period.end);
  }

  const [invoiceRes, supplierRes, pendingReceiptRes, bankTransactionRes, companyRes, prefsRes] = await Promise.all([
    invoiceQuery,
    supplierQuery,
    pendingReceiptQuery,
    bankTransactionQuery,
    supabase.from("companies").select("tva_regime, tva_assujetti").eq("user_id", ownerId).maybeSingle(),
    supabase.from("user_preferences").select("dashboard_deadlines").eq("user_id", ownerId).maybeSingle(),
  ]);

  const overdueInvoices = (invoiceRes.data ?? []).filter((invoice) => invoice.due_date && invoice.due_date < today);
  const overdueReceivable = overdueInvoices.reduce(
    (sum, invoice) => sum + Math.max(Number(invoice.total) - Number(invoice.montant_recu ?? 0), 0),
    0,
  );
  const overdueSuppliers = (supplierRes.data ?? []).filter((item: any) => {
    if (item.ocr_data?.document_type === "avoir" || item.ocr_data?.is_supplier_invoice === false) return false;
    const unpaid = item.ocr_data?.payment_status !== "paid" && item.status !== "paid";
    return unpaid && item.ocr_data?.due_date && item.ocr_data.due_date < today;
  });
  const overdueSupplierTotal = overdueSuppliers.reduce(
    (sum: number, item: any) => sum + Math.max(supplierTotal(item) - supplierPaid(item), 0),
    0,
  );

  const bankTransactionIds = (bankTransactionRes.data ?? []).map((transaction) => transaction.id);
  let matchedBankTransactionCount = 0;
  if (bankTransactionIds.length > 0) {
    const { data: allocations } = await supabase
      .from("invoice_payments")
      .select("transaction_id")
      .in("transaction_id", bankTransactionIds)
      .eq("allocation_status", "confirmed");
    matchedBankTransactionCount = new Set((allocations ?? []).map((item) => item.transaction_id).filter(Boolean)).size;
  }

  const deadlines = mergeDashboardDeadlines(
    (prefsRes.data?.dashboard_deadlines ?? null) as DashboardDeadline[] | null,
    now,
    {
      tvaRegime: companyRes.data?.tva_regime,
      tvaAssujetti: companyRes.data?.tva_assujetti,
    },
  )
    .map((deadline) => ({
      deadline,
      days: Math.ceil((parseDeadlineDate(deadline.date).getTime() - now.getTime()) / 86400000),
    }))
    .filter((item) => item.days >= 0 && item.days <= 30)
    .sort((a, b) => a.days - b.days);
  const nextDeadline = deadlines[0];

  return [
    {
      id: "overdue-client-invoices",
      title: "Factures clients en retard",
      description: overdueInvoices.length ? `${formatMoney(overdueReceivable)} en retard restent à encaisser.` : "Aucune facture client en retard.",
      count: overdueInvoices.length,
      href: "/suivi-paiements",
      actionLabel: "Relancer les clients",
      severity: "critical",
      category: "payments",
    },
    {
      id: "pending-documents",
      title: "Documents à traiter",
      description: "Pièces reçues qui attendent une vérification ou une affectation.",
      count: pendingReceiptRes.count ?? 0,
      href: "/achats",
      actionLabel: "Ouvrir les documents",
      severity: "warning",
      category: "documents",
    },
    {
      id: "unmatched-bank-transactions",
      title: "Transactions non affectées",
      description: "Mouvements bancaires sans facture ou document associé.",
      count: Math.max(0, bankTransactionIds.length - matchedBankTransactionCount),
      href: "/transactions",
      actionLabel: "Faire les rapprochements",
      severity: "warning",
      category: "bank",
    },
    {
      id: "overdue-supplier-invoices",
      title: "Fournisseurs en retard",
      description: overdueSuppliers.length ? `${formatMoney(overdueSupplierTotal)} en retard restent à payer.` : "Aucune facture fournisseur en retard.",
      count: overdueSuppliers.length,
      href: "/suivi-paiements",
      actionLabel: "Voir les échéances",
      severity: "critical",
      category: "payments",
    },
    ...(nextDeadline ? [{
      id: `deadline-${nextDeadline.deadline.id}`,
      title: "Déclaration à préparer",
      description: `${nextDeadline.deadline.title} · ${nextDeadline.days === 0 ? "aujourd’hui" : `dans ${nextDeadline.days} jours`}.`,
      count: 1,
      href: nextDeadline.deadline.id === "cnss" ? "/paie" : "/tva",
      actionLabel: "Préparer la déclaration",
      severity: nextDeadline.days <= 7 ? "critical" as const : "info" as const,
      category: "declarations" as const,
    }] : []),
  ];
}

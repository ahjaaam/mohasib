// Double-entry bookkeeping engine
// All functions accept a Supabase client so they work from any context (server routes, API routes, etc.)

import {
  getRevenueAccount, getExpenseAccount,
  getAccountLabel,
} from "./cgnc-mapping";
import { normalizeAccountingSettings, type AccountingSettings } from "./accounting-settings";
import {
  DISCOUNT_LABELS,
  type DiscountType,
} from "./invoice-discounts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BookableInvoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  total: number;       // TTC
  subtotal: number;    // HT
  tax_amount: number;  // TVA total
  discount_type?: DiscountType | null;
  discount_amount?: number;
  items: Array<{
    description: string;
    amount: number;     // HT line total (qty × unit_price)
    tva_rate?: number;
  }>;
  clients?: { name?: string | null } | null;
}

export interface BookablePurchase {
  id: string;
  date: string;
  description: string;
  total_ht: number;
  total_ttc: number;
  tva_amount: number;
  discount_amount?: number;
  commercial_discount_amount?: number;
  settlement_discount_amount?: number;
  category: string | null;
  expense_account?: string | null;
  supplier_name?: string | null;
  reference?: string | null;
}

export type SupplierCreditNoteAdjustmentType =
  | "commercial_reduction"
  | "purchase_return"
  | "invoice_correction"
  | "partial_cancellation"
  | "settlement_discount"
  | "other";

export interface BookableSupplierCreditNote {
  id: string;
  number: string;
  date: string;
  supplier_name: string;
  total_ht: number;
  total_ttc: number;
  tva_amount: number;
  supplier_account?: string | null;
  original_purchase_account: string;
  adjustment_type: SupplierCreditNoteAdjustmentType;
  reference?: string | null;
}

export interface BookableBankLine {
  id: string;
  date: string;
  description: string;
  amount: number;       // signed: positive=income, negative=expense
  category: string | null;
  invoice_id?: string | null; // if this payment settles an invoice
  counterpart_account?: string | null; // user-confirmed account opposite bank
  vat_status?: "not_applicable" | "pending_evidence" | "eligible" | "rejected";
  tax_amount?: number | null;
}

interface JournalEntry {
  journal: string;
  compte: string;
  compte_label: string;
  debit: number;
  credit: number;
  libelle: string;
  source_type: string;
  source_id: string;
  date_ecriture: string;
  numero_piece?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function validateBalance(entries: JournalEntry[]) {
  const totalDebit  = entries.reduce((s, e) => s + e.debit,  0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Double-entry imbalance: debit=${totalDebit.toFixed(2)} credit=${totalCredit.toFixed(2)}`);
  }
}

async function isAlreadyBooked(supabase: any, sourceId: string): Promise<boolean> {
  const { data } = await supabase
    .from("ecritures_comptables")
    .select("id")
    .eq("source_id", sourceId)
    .limit(1);
  return (data ?? []).length > 0;
}

async function insertEntries(
  supabase: any,
  entries: JournalEntry[],
  companyId?: string | null,
  dossierId?: string | null,
  options?: {
    finalizeDraftInvoice?: boolean;
    finalizeDraftCreditNote?: boolean;
    finalizeSupplierCreditNote?: boolean;
    finalizeReceiptPurchase?: boolean;
    confirmedOcr?: Record<string, unknown>;
  },
) {
  const rows = entries.map((e) => ({
    ...e,
    debit:  Math.round(e.debit  * 100) / 100,
    credit: Math.round(e.credit * 100) / 100,
    ...(companyId ? { company_id: companyId } : {}),
    ...(dossierId ? { dossier_id: dossierId } : {}),
  }));

  if (typeof supabase.rpc === "function") {
    const source = entries[0];
    const rpcName = options?.finalizeDraftInvoice
      ? "finalize_invoice_accounting_entries"
      : options?.finalizeDraftCreditNote
        ? "finalize_credit_note_accounting_entries"
        : options?.finalizeSupplierCreditNote
          ? "finalize_supplier_credit_note_accounting_entries"
          : options?.finalizeReceiptPurchase
            ? "finalize_receipt_purchase_accounting_entries"
        : "book_accounting_entries";
    const { error } = await supabase.rpc(rpcName, {
      p_company_id: companyId ?? null,
      p_dossier_id: dossierId ?? null,
      p_source_type: source.source_type,
      p_source_id: source.source_id,
      p_entries: rows,
      ...(options?.finalizeReceiptPurchase ? { p_ocr_data: options.confirmedOcr } : {}),
    });
    if (error) throw new Error(`Failed to insert journal entries: ${error.message}`);
    return;
  }

  // Test doubles and non-Supabase adapters keep the direct insertion path.
  const { error } = await supabase.from("ecritures_comptables").insert(rows);
  if (error) throw new Error(`Failed to insert journal entries: ${error.message}`);
}

// ── bookSalesInvoice ──────────────────────────────────────────────────────────

export async function bookSalesInvoice(
  supabase: any,
  invoice: BookableInvoice,
  companyId?: string | null,
  dossierId?: string | null,
  accountingSettings?: Partial<AccountingSettings> | null,
  options?: { finalizeDraftInvoice?: boolean },
) {
  if (!options?.finalizeDraftInvoice && await isAlreadyBooked(supabase, invoice.id)) return;

  const accounts = normalizeAccountingSettings(accountingSettings);
  const clientName = invoice.clients?.name ?? "Client";
  const entries: JournalEntry[] = [];

  // 1 — Debit the configured client receivable account for TTC
  entries.push({
    journal: "VT",
    compte: accounts.clientAccount,
    compte_label: getAccountLabel(accounts.clientAccount),
    debit: invoice.total,
    credit: 0,
    libelle: `Facture ${invoice.invoice_number} — ${clientName}`,
    source_type: "invoice",
    source_id: invoice.id,
    date_ecriture: invoice.issue_date,
    numero_piece: invoice.invoice_number,
  });

  // 2 — Credit revenue accounts per line (by TVA rate)
  const groupedByRate: Record<number, number> = {};
  for (const line of invoice.items) {
    const rate = line.tva_rate ?? 20;
    groupedByRate[rate] = (groupedByRate[rate] ?? 0) + line.amount;
  }

  // If no items breakdown, use invoice subtotal
  if (invoice.items.length === 0) {
    groupedByRate[20] = invoice.subtotal;
  }

  for (const [rateStr, htAmount] of Object.entries(groupedByRate)) {
    const rate = Number(rateStr);
    const revenueAccount = accounts.salesAccount;
    entries.push({
      journal: "VT",
      compte: revenueAccount,
      compte_label: getAccountLabel(revenueAccount),
      debit: 0,
      credit: Math.round(htAmount * 100) / 100,
      libelle: `Ventes ${invoice.invoice_number} — TVA ${rate}%`,
      source_type: "invoice",
      source_id: invoice.id,
      date_ecriture: invoice.issue_date,
      numero_piece: invoice.invoice_number,
    });
  }

  if ((invoice.discount_amount ?? 0) > 0 && invoice.discount_type && invoice.discount_type !== "none") {
    const discountAccount = invoice.discount_type === "escompte"
      ? accounts.salesSettlementDiscountAccount
      : accounts.salesCommercialDiscountAccount;
    entries.push({
      journal: "VT",
      compte: discountAccount,
      compte_label: getAccountLabel(discountAccount),
      debit: invoice.discount_amount ?? 0,
      credit: 0,
      libelle: `${DISCOUNT_LABELS[invoice.discount_type]} — ${invoice.invoice_number}`,
      source_type: "invoice",
      source_id: invoice.id,
      date_ecriture: invoice.issue_date,
      numero_piece: invoice.invoice_number,
    });
  }

  // 3 — Credit the configured collected-TVA account
  if (invoice.tax_amount > 0) {
    entries.push({
      journal: "VT",
      compte: accounts.collectedTvaAccount,
      compte_label: getAccountLabel(accounts.collectedTvaAccount),
      debit: 0,
      credit: invoice.tax_amount,
      libelle: `TVA collectée — ${invoice.invoice_number}`,
      source_type: "invoice",
      source_id: invoice.id,
      date_ecriture: invoice.issue_date,
      numero_piece: invoice.invoice_number,
    });
  }

  validateBalance(entries);
  await insertEntries(supabase, entries, companyId, dossierId, options);
}

// ── bookPurchaseInvoice ───────────────────────────────────────────────────────

export async function bookPurchaseInvoice(
  supabase: any,
  purchase: BookablePurchase,
  companyId?: string | null,
  dossierId?: string | null,
  accountingSettings?: Partial<AccountingSettings> | null,
  options?: { finalizeReceiptPurchase?: boolean; confirmedOcr?: Record<string, unknown> },
) {
  if (!options?.finalizeReceiptPurchase && await isAlreadyBooked(supabase, purchase.id)) return;

  const accounts = normalizeAccountingSettings(accountingSettings);
  const expenseAccount = purchase.expense_account || getExpenseAccount(purchase.category ?? "", accounts.expenseCategoryAccounts);
  const supplierLabel  = purchase.supplier_name ?? "Fournisseur";
  const entries: JournalEntry[] = [];

  // 1 — Debit 6xxx (expense)
  entries.push({
    journal: "AC",
    compte: expenseAccount,
    compte_label: getAccountLabel(expenseAccount),
    debit: purchase.total_ht,
    credit: 0,
    libelle: purchase.description,
    source_type: "purchase",
    source_id: purchase.id,
    date_ecriture: purchase.date,
    numero_piece: purchase.reference ?? undefined,
  });

  // 2 — Debit the configured recoverable-TVA account
  if (purchase.tva_amount > 0) {
    entries.push({
      journal: "AC",
      compte: accounts.recoverableTvaAccount,
      compte_label: getAccountLabel(accounts.recoverableTvaAccount),
      debit: purchase.tva_amount,
      credit: 0,
      libelle: `TVA déductible — ${purchase.reference ?? purchase.description}`,
      source_type: "purchase",
      source_id: purchase.id,
      date_ecriture: purchase.date,
      numero_piece: purchase.reference ?? undefined,
    });
  }

  const settlementDiscount = purchase.settlement_discount_amount ?? 0;

  // 3 — Commercial reductions printed on the invoice are already included in
  // the net-commercial purchase debit. Only settlement discounts are separate.
  if (settlementDiscount > 0) {
    entries.push({
      journal: "AC",
      compte: accounts.purchaseSettlementDiscountAccount,
      compte_label: getAccountLabel(accounts.purchaseSettlementDiscountAccount),
      debit: 0,
      credit: settlementDiscount,
      libelle: `Escompte obtenu — ${purchase.reference ?? purchase.description}`,
      source_type: "purchase",
      source_id: purchase.id,
      date_ecriture: purchase.date,
      numero_piece: purchase.reference ?? undefined,
    });
  }

  // 4 — Credit the configured supplier account for the net TTC payable
  entries.push({
    journal: "AC",
    compte: accounts.supplierAccount,
    compte_label: getAccountLabel(accounts.supplierAccount),
    debit: 0,
    credit: purchase.total_ttc,
    libelle: `${supplierLabel} — ${purchase.reference ?? purchase.description}`,
    source_type: "purchase",
    source_id: purchase.id,
    date_ecriture: purchase.date,
    numero_piece: purchase.reference ?? undefined,
  });

  validateBalance(entries);
  await insertEntries(supabase, entries, companyId, dossierId, options);
}

// ── bookSupplierCreditNote ───────────────────────────────────────────────────

export function supplierCreditNoteCounterpartAccount(
  adjustmentType: SupplierCreditNoteAdjustmentType,
  originalPurchaseAccount: string,
  accountingSettings?: Partial<AccountingSettings> | null,
) {
  const accounts = normalizeAccountingSettings(accountingSettings);
  if (adjustmentType === "settlement_discount") {
    return accounts.purchaseSettlementDiscountAccount;
  }
  if (adjustmentType !== "commercial_reduction") {
    return originalPurchaseAccount;
  }
  if (originalPurchaseAccount.startsWith("611")) return accounts.purchaseDiscountAccount;
  if (originalPurchaseAccount.startsWith("612")) return accounts.purchaseConsumedDiscountAccount;
  if (originalPurchaseAccount.startsWith("613") || originalPurchaseAccount.startsWith("614")) {
    return accounts.purchaseExternalDiscountAccount;
  }
  // A reduction related to an asset or another purchase class reverses that
  // original account because there is no matching 61x9 RRR family.
  return originalPurchaseAccount;
}

export async function bookSupplierCreditNote(
  supabase: any,
  creditNote: BookableSupplierCreditNote,
  companyId?: string | null,
  dossierId?: string | null,
  accountingSettings?: Partial<AccountingSettings> | null,
  options?: { finalizeSupplierCreditNote?: boolean },
) {
  if (!options?.finalizeSupplierCreditNote && await isAlreadyBooked(supabase, creditNote.id)) return;

  const accounts = normalizeAccountingSettings(accountingSettings);
  const supplierAccount = creditNote.supplier_account || accounts.supplierAccount;
  const counterpartAccount = supplierCreditNoteCounterpartAccount(
    creditNote.adjustment_type,
    creditNote.original_purchase_account,
    accountingSettings,
  );
  const piece = creditNote.reference || creditNote.number;
  const entries: JournalEntry[] = [
    {
      journal: "AC",
      compte: supplierAccount,
      compte_label: getAccountLabel(supplierAccount),
      debit: creditNote.total_ttc,
      credit: 0,
      libelle: `Avoir ${piece} — ${creditNote.supplier_name}`,
      source_type: "supplier_credit_note",
      source_id: creditNote.id,
      date_ecriture: creditNote.date,
      numero_piece: piece,
    },
    {
      journal: "AC",
      compte: counterpartAccount,
      compte_label: getAccountLabel(counterpartAccount),
      debit: 0,
      credit: creditNote.total_ht,
      libelle: `Avoir fournisseur — ${piece}`,
      source_type: "supplier_credit_note",
      source_id: creditNote.id,
      date_ecriture: creditNote.date,
      numero_piece: piece,
    },
  ];

  if (creditNote.tva_amount > 0) {
    entries.push({
      journal: "AC",
      compte: accounts.recoverableTvaAccount,
      compte_label: getAccountLabel(accounts.recoverableTvaAccount),
      debit: 0,
      credit: creditNote.tva_amount,
      libelle: `TVA récupérable annulée — ${piece}`,
      source_type: "supplier_credit_note",
      source_id: creditNote.id,
      date_ecriture: creditNote.date,
      numero_piece: piece,
    });
  }

  validateBalance(entries);
  await insertEntries(supabase, entries, companyId, dossierId, options);
}

// ── bookBankTransaction ───────────────────────────────────────────────────────

export async function bookBankTransaction(
  supabase: any,
  bankLine: BookableBankLine,
  companyId?: string | null,
  dossierId?: string | null,
  accountingSettings?: Partial<AccountingSettings> | null,
) {
  if (await isAlreadyBooked(supabase, bankLine.id)) return;

  const accounts = normalizeAccountingSettings(accountingSettings);
  const isIncome  = bankLine.amount >= 0;
  const absAmount = Math.abs(bankLine.amount);
  const entries: JournalEntry[] = [];

  if (isIncome) {
    if (bankLine.invoice_id && !bankLine.counterpart_account) {
      // Payment that settles a client invoice: DEBIT bank, CREDIT client receivable
      entries.push(
        {
          journal: "BQ",
          compte: accounts.bankAccount,
          compte_label: getAccountLabel(accounts.bankAccount),
          debit: absAmount,
          credit: 0,
          libelle: bankLine.description,
          source_type: "bank",
          source_id: bankLine.id,
          date_ecriture: bankLine.date,
        },
        {
          journal: "BQ",
          compte: accounts.clientAccount,
          compte_label: getAccountLabel(accounts.clientAccount),
          debit: 0,
          credit: absAmount,
          libelle: bankLine.description,
          source_type: "bank",
          source_id: bankLine.id,
          date_ecriture: bankLine.date,
        },
      );
    } else {
      // General income: DEBIT bank, CREDIT revenue
      const revenueAccount = bankLine.counterpart_account || getRevenueAccount(bankLine.category ?? "", accounts.revenueCategoryAccounts);
      entries.push(
        {
          journal: "BQ",
          compte: accounts.bankAccount,
          compte_label: getAccountLabel(accounts.bankAccount),
          debit: absAmount,
          credit: 0,
          libelle: bankLine.description,
          source_type: "bank",
          source_id: bankLine.id,
          date_ecriture: bankLine.date,
        },
        {
          journal: "BQ",
          compte: revenueAccount,
          compte_label: getAccountLabel(revenueAccount),
          debit: 0,
          credit: absAmount,
          libelle: bankLine.description,
          source_type: "bank",
          source_id: bankLine.id,
          date_ecriture: bankLine.date,
        },
      );
    }
  } else {
    // Expense: DEBIT expense account, CREDIT bank
    const expenseAccount = bankLine.counterpart_account || getExpenseAccount(bankLine.category ?? "", accounts.expenseCategoryAccounts);
    const deductibleVat = bankLine.vat_status === "eligible"
      ? Math.min(Math.max(Number(bankLine.tax_amount ?? 0), 0), absAmount)
      : 0;
    entries.push(
      {
        journal: "BQ",
        compte: expenseAccount,
        compte_label: getAccountLabel(expenseAccount),
        debit: absAmount - deductibleVat,
        credit: 0,
        libelle: bankLine.description,
        source_type: "bank",
        source_id: bankLine.id,
        date_ecriture: bankLine.date,
      },
      ...(deductibleVat > 0 ? [{
        journal: "BQ",
        compte: accounts.recoverableTvaAccount,
        compte_label: getAccountLabel(accounts.recoverableTvaAccount),
        debit: deductibleVat,
        credit: 0,
        libelle: `TVA déductible · ${bankLine.description}`,
        source_type: "bank",
        source_id: bankLine.id,
        date_ecriture: bankLine.date,
      }] : []),
      {
        journal: "BQ",
        compte: accounts.bankAccount,
        compte_label: getAccountLabel(accounts.bankAccount),
        debit: 0,
        credit: absAmount,
        libelle: bankLine.description,
        source_type: "bank",
        source_id: bankLine.id,
        date_ecriture: bankLine.date,
      },
    );
  }

  validateBalance(entries);
  await insertEntries(supabase, entries, companyId, dossierId);
}

// ── bookAvoirClient ───────────────────────────────────────────────────────────
// Mirror of bookSalesInvoice: debits revenue/TVA, credits client receivable.

export async function bookAvoirClient(
  supabase: any,
  avoir: BookableInvoice,
  companyId?: string | null,
  dossierId?: string | null,
  accountingSettings?: Partial<AccountingSettings> | null,
  options?: { finalizeDraftCreditNote?: boolean },
) {
  if (!options?.finalizeDraftCreditNote && await isAlreadyBooked(supabase, avoir.id)) return;

  const accounts = normalizeAccountingSettings(accountingSettings);
  const clientName = avoir.clients?.name ?? "Client";
  const entries: JournalEntry[] = [];

  // 1 — Credit the configured client account (reduce receivable) for TTC
  entries.push({
    journal: "VT",
    compte: accounts.clientAccount,
    compte_label: getAccountLabel(accounts.clientAccount),
    debit: 0,
    credit: avoir.total,
    libelle: `Avoir ${avoir.invoice_number} — ${clientName}`,
    source_type: "avoir_client",
    source_id: avoir.id,
    date_ecriture: avoir.issue_date,
    numero_piece: avoir.invoice_number,
  });

  // 2 — Debit revenue accounts per line (reverse revenue)
  const groupedByRate: Record<number, number> = {};
  for (const line of avoir.items) {
    const rate = line.tva_rate ?? 20;
    groupedByRate[rate] = (groupedByRate[rate] ?? 0) + line.amount;
  }
  if (avoir.items.length === 0) groupedByRate[20] = avoir.subtotal;

  for (const [rateStr, htAmount] of Object.entries(groupedByRate)) {
    const rate = Number(rateStr);
    const revenueAccount = accounts.salesAccount;
    entries.push({
      journal: "VT",
      compte: revenueAccount,
      compte_label: getAccountLabel(revenueAccount),
      debit: Math.round(htAmount * 100) / 100,
      credit: 0,
      libelle: `Avoir ventes ${avoir.invoice_number} — TVA ${rate}%`,
      source_type: "avoir_client",
      source_id: avoir.id,
      date_ecriture: avoir.issue_date,
      numero_piece: avoir.invoice_number,
    });
  }

  // 3 — Debit the configured collected-TVA account
  if (avoir.tax_amount > 0) {
    entries.push({
      journal: "VT",
      compte: accounts.collectedTvaAccount,
      compte_label: getAccountLabel(accounts.collectedTvaAccount),
      debit: avoir.tax_amount,
      credit: 0,
      libelle: `TVA collectée annulée — ${avoir.invoice_number}`,
      source_type: "avoir_client",
      source_id: avoir.id,
      date_ecriture: avoir.issue_date,
      numero_piece: avoir.invoice_number,
    });
  }

  validateBalance(entries);
  await insertEntries(supabase, entries, companyId, dossierId, options);
}

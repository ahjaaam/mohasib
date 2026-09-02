// Double-entry bookkeeping engine
// All functions accept a Supabase client so they work from any context (server routes, API routes, etc.)

import {
  getRevenueAccount, getExpenseAccount,
  getTVACollectedAccount, getTVARecoverableAccount, getAccountLabel,
} from "./cgnc-mapping";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BookableInvoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  total: number;       // TTC
  subtotal: number;    // HT
  tax_amount: number;  // TVA total
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
  category: string | null;
  expense_account?: string | null;
  supplier_name?: string | null;
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
) {
  const rows = entries.map((e) => ({
    ...e,
    debit:  Math.round(e.debit  * 100) / 100,
    credit: Math.round(e.credit * 100) / 100,
    ...(companyId ? { company_id: companyId } : {}),
    ...(dossierId ? { dossier_id: dossierId } : {}),
  }));
  const { error } = await supabase.from("ecritures_comptables").insert(rows);
  if (error) throw new Error(`Failed to insert journal entries: ${error.message}`);
}

// ── bookSalesInvoice ──────────────────────────────────────────────────────────

export async function bookSalesInvoice(
  supabase: any,
  invoice: BookableInvoice,
  companyId?: string | null,
  dossierId?: string | null,
) {
  if (await isAlreadyBooked(supabase, invoice.id)) return;

  const clientName = invoice.clients?.name ?? "Client";
  const entries: JournalEntry[] = [];

  // 1 — Debit 3421 (client debt) for TTC
  entries.push({
    journal: "VT",
    compte: "3421",
    compte_label: getAccountLabel("3421"),
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
    const category = invoice.clients?.name ? "Services" : "Services";
    const revenueAccount = getRevenueAccount(category, rate);
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

  // 3 — Credit 4455 (TVA collectée)
  if (invoice.tax_amount > 0) {
    entries.push({
      journal: "VT",
      compte: getTVACollectedAccount(20),
      compte_label: getAccountLabel("4455"),
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
  await insertEntries(supabase, entries, companyId, dossierId);
}

// ── bookPurchaseInvoice ───────────────────────────────────────────────────────

export async function bookPurchaseInvoice(
  supabase: any,
  purchase: BookablePurchase,
  companyId?: string | null,
  dossierId?: string | null,
) {
  if (await isAlreadyBooked(supabase, purchase.id)) return;

  const expenseAccount = purchase.expense_account || getExpenseAccount(purchase.category ?? "");
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

  // 2 — Debit 3455 (TVA récupérable)
  if (purchase.tva_amount > 0) {
    entries.push({
      journal: "AC",
      compte: getTVARecoverableAccount(),
      compte_label: getAccountLabel("3455"),
      debit: purchase.tva_amount,
      credit: 0,
      libelle: `TVA déductible — ${purchase.reference ?? purchase.description}`,
      source_type: "purchase",
      source_id: purchase.id,
      date_ecriture: purchase.date,
      numero_piece: purchase.reference ?? undefined,
    });
  }

  // 3 — Credit 6119 for a discount granted after the invoice's gross TTC.
  // This preserves the invoice's original HT and TVA bases while reducing the
  // amount owed to the supplier.
  if ((purchase.discount_amount ?? 0) > 0) {
    entries.push({
      journal: "AC",
      compte: "6119",
      compte_label: getAccountLabel("6119"),
      debit: 0,
      credit: purchase.discount_amount ?? 0,
      libelle: `Remise obtenue — ${purchase.reference ?? purchase.description}`,
      source_type: "purchase",
      source_id: purchase.id,
      date_ecriture: purchase.date,
      numero_piece: purchase.reference ?? undefined,
    });
  }

  // 4 — Credit 4411 (supplier debt) for the net TTC payable
  entries.push({
    journal: "AC",
    compte: "4411",
    compte_label: getAccountLabel("4411"),
    debit: 0,
    credit: purchase.total_ttc,
    libelle: `${supplierLabel} — ${purchase.reference ?? purchase.description}`,
    source_type: "purchase",
    source_id: purchase.id,
    date_ecriture: purchase.date,
    numero_piece: purchase.reference ?? undefined,
  });

  validateBalance(entries);
  await insertEntries(supabase, entries, companyId, dossierId);
}

// ── bookBankTransaction ───────────────────────────────────────────────────────

export async function bookBankTransaction(
  supabase: any,
  bankLine: BookableBankLine,
  companyId?: string | null,
  dossierId?: string | null,
) {
  if (await isAlreadyBooked(supabase, bankLine.id)) return;

  const isIncome  = bankLine.amount >= 0;
  const absAmount = Math.abs(bankLine.amount);
  const entries: JournalEntry[] = [];

  if (isIncome) {
    if (bankLine.invoice_id && !bankLine.counterpart_account) {
      // Payment that settles a client invoice: DEBIT bank, CREDIT 3421
      entries.push(
        {
          journal: "BQ",
          compte: "5141",
          compte_label: getAccountLabel("5141"),
          debit: absAmount,
          credit: 0,
          libelle: bankLine.description,
          source_type: "bank",
          source_id: bankLine.id,
          date_ecriture: bankLine.date,
        },
        {
          journal: "BQ",
          compte: "3421",
          compte_label: getAccountLabel("3421"),
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
      const revenueAccount = bankLine.counterpart_account || getRevenueAccount(bankLine.category ?? "");
      entries.push(
        {
          journal: "BQ",
          compte: "5141",
          compte_label: getAccountLabel("5141"),
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
    const expenseAccount = bankLine.counterpart_account || getExpenseAccount(bankLine.category ?? "");
    entries.push(
      {
        journal: "BQ",
        compte: expenseAccount,
        compte_label: getAccountLabel(expenseAccount),
        debit: absAmount,
        credit: 0,
        libelle: bankLine.description,
        source_type: "bank",
        source_id: bankLine.id,
        date_ecriture: bankLine.date,
      },
      {
        journal: "BQ",
        compte: "5141",
        compte_label: getAccountLabel("5141"),
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
) {
  if (await isAlreadyBooked(supabase, avoir.id)) return;

  const clientName = avoir.clients?.name ?? "Client";
  const entries: JournalEntry[] = [];

  // 1 — Credit 3421 (reduce client receivable) for TTC
  entries.push({
    journal: "VT",
    compte: "3421",
    compte_label: getAccountLabel("3421"),
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
    const revenueAccount = getRevenueAccount("Services", rate);
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

  // 3 — Debit 4455 (reverse TVA collectée)
  if (avoir.tax_amount > 0) {
    entries.push({
      journal: "VT",
      compte: getTVACollectedAccount(20),
      compte_label: getAccountLabel("4455"),
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
  await insertEntries(supabase, entries, companyId, dossierId);
}

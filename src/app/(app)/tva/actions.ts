"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TVAInvoiceDetail {
  id: string;
  invoice_number: string;
  client_name: string;
  issue_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
}

export interface TVADeductionRow {
  id: string;
  date_facture: string;
  numero_facture: string;
  fournisseur_nom: string;
  fournisseur_if: string;
  fournisseur_ice: string;
  designation: string;
  montant_ht: number;
  taux_tva: number;
  montant_tva: number;
  mode_paiement: string;
  date_paiement: string;
  prorata: number;
  tva_deductible: number;
  type_deduction: string;
}

export interface TVACalcResult {
  // Section A
  ca_total: number;
  // Section B by rate
  ca_7: number; ca_10: number; ca_14: number; ca_20: number;
  // Section D TVA by rate
  tva_7: number; tva_10: number; tva_14: number; tva_20: number;
  tva_collectee_total: number;
  // Section E
  deductions_charges: number;
  deductions_immobilisations: number;
  deductions_total: number;
  credit_reporte: number;
  // Droits de timbre
  nb_factures: number;
  droits_timbre: number;
  // Section F
  tva_nette_due: number;
  credit_tva: number;
  // Annual
  ca_exercice_annuel: number;
  // Details
  invoices: TVAInvoiceDetail[];
  deductions: TVADeductionRow[];
}

export interface TVADeclaration {
  id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  regime: string;
  tva_collectee: number;
  tva_deductible: number;
  tva_nette: number;
  tva_nette_due?: number;
  credit_tva?: number;
  statut?: string;
  status: string;
  filed_at: string | null;
  deposee_at?: string | null;
  created_at: string;
}

// ─── Calculate TVA for a period ──────────────────────────────────────────────

export async function calculateTVAForPeriod(
  periodStart: string,
  periodEnd: string,
): Promise<{ data?: TVACalcResult; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };
  const ownerId = await resolveAccountOwnerId(user.id);

  const [invRes, avoirClientRes, expRes, avoirFournisseurRes, lastDeclRes, yearInvRes] = await Promise.all([
    // 1. Regular invoices
    supabase
      .from("invoices")
      .select("id, invoice_number, subtotal, tax_rate, tax_amount, total, issue_date, items, clients(name)")
      .eq("user_id", ownerId)
      .is("dossier_id", null)
      .eq("invoice_type", "facture")
      .not("status", "in", '("draft","cancelled")')
      .gte("issue_date", periodStart)
      .lte("issue_date", periodEnd)
      .order("issue_date", { ascending: true }),
    // 2. Avoir clients (reduce TVA collectée)
    supabase
      .from("invoices")
      .select("subtotal, tax_rate, tax_amount, items")
      .eq("user_id", ownerId)
      .is("dossier_id", null)
      .eq("invoice_type", "avoir_client")
      .not("status", "in", '("draft","cancelled")')
      .gte("issue_date", periodStart)
      .lte("issue_date", periodEnd),
    // 3. Expense transactions
    supabase
      .from("transactions")
      .select("id, description, category, date, amount, tva_rate, tva_amount, fournisseur, if_fournisseur, ice_fournisseur, mode_paiement, date_paiement, compte_comptable")
      .eq("user_id", ownerId)
      .is("dossier_id", null)
      .eq("type", "expense")
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date", { ascending: true }),
    // 4. Avoirs fournisseurs (reduce TVA déductible)
    supabase
      .from("avoirs_fournisseurs")
      .select("tva_amount, tva_rate, compte_comptable")
      .eq("user_id", ownerId)
      .gte("date", periodStart)
      .lte("date", periodEnd),
    // 5. Last TVA declaration (for credit reporté)
    supabase
      .from("tva_declarations")
      .select("credit_tva, tva_nette_due")
      .eq("user_id", ownerId)
      .lt("period_end", periodStart)
      .order("period_end", { ascending: false })
      .limit(1),
    // 6. Annual CA
    supabase
      .from("invoices")
      .select("subtotal")
      .eq("user_id", ownerId)
      .is("dossier_id", null)
      .not("status", "in", '("draft","cancelled")')
      .gte("issue_date", `${periodStart.slice(0, 4)}-01-01`)
      .lte("issue_date", `${periodStart.slice(0, 4)}-12-31`),
  ]);

  if (invRes.error) return { error: invRes.error.message };

  // ── Section A + B: CA by rate ────────────────────────────────────────────
  let ca_7 = 0, ca_10 = 0, ca_14 = 0, ca_20 = 0;
  const invoices: TVAInvoiceDetail[] = [];

  for (const inv of invRes.data ?? []) {
    const items = (inv.items ?? []) as any[];
    const hasItemRates = items.some((it: any) => it.tva_rate != null);

    if (hasItemRates && items.length > 0) {
      for (const it of items) {
        const rate = Number(it.tva_rate ?? inv.tax_rate ?? 20);
        const ht = Number(it.amount ?? 0);
        if (rate === 7) ca_7 += ht;
        else if (rate === 10) ca_10 += ht;
        else if (rate === 14) ca_14 += ht;
        else ca_20 += ht;
      }
    } else {
      const rate = Number(inv.tax_rate ?? 20);
      const ht = Number(inv.subtotal ?? 0);
      if (rate === 7) ca_7 += ht;
      else if (rate === 10) ca_10 += ht;
      else if (rate === 14) ca_14 += ht;
      else ca_20 += ht;
    }
    invoices.push({
      id: inv.id,
      invoice_number: inv.invoice_number,
      client_name: (inv as any).clients?.name ?? "—",
      issue_date: inv.issue_date,
      subtotal: Number(inv.subtotal),
      tax_rate: Number(inv.tax_rate),
      tax_amount: Number(inv.tax_amount),
      total: Number(inv.total),
    });
  }

  // ── Subtract avoir clients from CA per rate ─────────────────────────────
  for (const av of avoirClientRes.data ?? []) {
    const items = (av.items ?? []) as any[];
    const hasItemRates = items.some((it: any) => it.tva_rate != null);
    if (hasItemRates && items.length > 0) {
      for (const it of items) {
        const rate = Number(it.tva_rate ?? av.tax_rate ?? 20);
        const ht = Number(it.amount ?? 0);
        if (rate === 7) ca_7 -= ht;
        else if (rate === 10) ca_10 -= ht;
        else if (rate === 14) ca_14 -= ht;
        else ca_20 -= ht;
      }
    } else {
      const rate = Number(av.tax_rate ?? 20);
      const ht = Number(av.subtotal ?? 0);
      if (rate === 7) ca_7 -= ht;
      else if (rate === 10) ca_10 -= ht;
      else if (rate === 14) ca_14 -= ht;
      else ca_20 -= ht;
    }
  }

  const ca_total = Math.max(0, ca_7 + ca_10 + ca_14 + ca_20);

  // ── Section D: TVA collectée ────────────────────────────────────────────
  const tva_7  = Math.max(0, ca_7)  * 0.07;
  const tva_10 = Math.max(0, ca_10) * 0.10;
  const tva_14 = Math.max(0, ca_14) * 0.14;
  const tva_20 = Math.max(0, ca_20) * 0.20;
  const tva_collectee_total = tva_7 + tva_10 + tva_14 + tva_20;

  // ── Section E: Déductions ───────────────────────────────────────────────
  let deductions_charges = 0, deductions_immobilisations = 0;
  const deductions: TVADeductionRow[] = [];

  for (const exp of expRes.data ?? []) {
    const rate = Number((exp as any).tva_rate ?? 20);
    const ht = Number(exp.amount ?? 0);
    const tva = (exp as any).tva_amount != null
      ? Number((exp as any).tva_amount)
      : ht * rate / 100;
    const isImmo = (exp as any).compte_comptable?.startsWith("2") ?? false;
    if (isImmo) deductions_immobilisations += tva;
    else deductions_charges += tva;

    deductions.push({
      id: exp.id,
      date_facture: exp.date,
      numero_facture: "",
      fournisseur_nom: (exp as any).fournisseur ?? exp.description ?? "—",
      fournisseur_if: (exp as any).if_fournisseur ?? "",
      fournisseur_ice: (exp as any).ice_fournisseur ?? "",
      designation: exp.description ?? "—",
      montant_ht: ht,
      taux_tva: rate,
      montant_tva: tva,
      mode_paiement: (exp as any).mode_paiement ?? "",
      date_paiement: (exp as any).date_paiement ?? exp.date,
      prorata: 100,
      tva_deductible: tva,
      type_deduction: isImmo ? "immobilisation" : "charge",
    });
  }

  // ── Subtract avoirs fournisseurs from deductions ────────────────────────
  for (const af of avoirFournisseurRes.data ?? []) {
    const tva = Number((af as any).tva_amount ?? 0);
    const isImmo = (af as any).compte_comptable?.startsWith("2") ?? false;
    if (isImmo) deductions_immobilisations = Math.max(0, deductions_immobilisations - tva);
    else deductions_charges = Math.max(0, deductions_charges - tva);
  }

  const deductions_total = deductions_charges + deductions_immobilisations;
  const lastDecl = lastDeclRes.data?.[0];
  const credit_reporte = Number((lastDecl as any)?.credit_tva ?? 0);

  // ── Droits de timbre ────────────────────────────────────────────────────
  const nb_factures = invoices.length;
  const droits_timbre = nb_factures * 2;

  // ── Section F ───────────────────────────────────────────────────────────
  const totalDed = deductions_total + credit_reporte;
  const raw = tva_collectee_total + droits_timbre - totalDed;
  const tva_nette_due = Math.max(0, raw);
  const credit_tva    = Math.max(0, -raw);

  // ── Annual ──────────────────────────────────────────────────────────────
  const ca_exercice_annuel = ((yearInvRes as any)?.data ?? []).reduce(
    (s: number, inv: any) => s + Number(inv.subtotal ?? 0), 0
  );

  return {
    data: {
      ca_total, ca_7, ca_10, ca_14, ca_20,
      tva_7, tva_10, tva_14, tva_20, tva_collectee_total,
      deductions_charges, deductions_immobilisations, deductions_total,
      credit_reporte, nb_factures, droits_timbre,
      tva_nette_due, credit_tva,
      ca_exercice_annuel, invoices, deductions,
    },
  };
}

// ─── Save / validate declaration ─────────────────────────────────────────────

export async function saveDeclaration(params: {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  regime: string;
  statut: "brouillon" | "validé" | "déposé";
  calc: TVACalcResult;
  overrides: Partial<TVACalcResult>;
  odTva: number;
  odTvaNote: string;
  caExporte: number;
  caExonere: number;
  caHorsChamp: number;
  caSuspension: number;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };
  const ownerId = await resolveAccountOwnerId(user.id);

  const { data: company } = await supabase.from("companies").select("id").eq("user_id", ownerId).single();

  const c = { ...params.calc, ...params.overrides };
  const tvaNette = c.tva_collectee_total + params.odTva + c.droits_timbre - c.deductions_total - c.credit_reporte;

  try {
    await supabase.from("tva_declarations").upsert(
      {
        company_id: company?.id,
        user_id: ownerId,
        period_start: params.periodStart,
        period_end: params.periodEnd,
        period_label: params.periodLabel,
        regime: params.regime,
        statut: params.statut,
        // legacy fields
        tva_collectee: c.tva_collectee_total,
        tva_deductible: c.deductions_total,
        tva_nette: tvaNette,
        status: params.statut === "déposé" ? "filed" : "pending",
        filed_at: params.statut === "déposé" ? new Date().toISOString() : null,
        deposee_at: params.statut === "déposé" ? new Date().toISOString() : null,
        // Section A
        ca_total: c.ca_total,
        ca_exporte: params.caExporte,
        ca_exonere: params.caExonere,
        ca_hors_champ: params.caHorsChamp,
        ca_suspension: params.caSuspension,
        // Section B
        ca_imposable_7: c.ca_7,
        ca_imposable_10: c.ca_10,
        ca_imposable_14: c.ca_14,
        ca_imposable_20: c.ca_20,
        // Section D
        tva_7: c.tva_7, tva_10: c.tva_10, tva_14: c.tva_14, tva_20: c.tva_20,
        tva_collectee_total: c.tva_collectee_total,
        od_tva: params.odTva,
        od_tva_note: params.odTvaNote,
        // Section E
        deductions_charges: c.deductions_charges,
        deductions_immobilisations: c.deductions_immobilisations,
        deductions_total: c.deductions_total,
        credit_reporte: c.credit_reporte,
        // Droits de timbre
        nb_factures: c.nb_factures,
        droits_timbre: c.droits_timbre,
        // Section F
        tva_nette_due: Math.max(0, tvaNette),
        credit_tva: Math.max(0, -tvaNette),
        // Annual
        ca_exercice_annuel: c.ca_exercice_annuel,
      },
      { onConflict: "user_id,period_start,period_end", ignoreDuplicates: false }
    );
  } catch (e: any) {
    return { error: e?.message ?? "Erreur sauvegarde" };
  }
  return {};
}

// ─── Fetch declaration history ────────────────────────────────────────────────

export async function fetchDeclarationHistory(): Promise<TVADeclaration[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const ownerId = await resolveAccountOwnerId(user.id);
  try {
    const { data } = await supabase
      .from("tva_declarations")
      .select("*")
      .eq("user_id", ownerId)
      .order("period_start", { ascending: false })
      .limit(24);
    return (data ?? []) as TVADeclaration[];
  } catch {
    return [];
  }
}

// Legacy type alias for any remaining callers
export type TVAData = TVACalcResult;

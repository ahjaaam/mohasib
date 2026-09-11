"use server";

import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { checkPeriodLocked, createVersion, getDiff, lockAccountingPeriod, logAccountingEvent, logAudit } from "@/lib/audit";
import { annualInvoiceTurnover, invoiceVatContributionsForPeriod, type VatRateBucket, type VatTaxPoint } from "@/lib/tva-invoice-aggregation";
import { calculatePeriodCashReceiptStampDuty } from "@/lib/stamp-duty";
import { isMissingDatabaseColumn, isUndefinedDatabaseColumn } from "@/lib/schema-compatibility";

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

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
  ca_hors_champ: number;
  ca_exonere_sans_droit: number;
  ca_exonere_avec_droit: number;
  ca_suspension: number;
  ca_zero_non_classe: number;
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
  dossierId?: string,
): Promise<{ data?: TVACalcResult; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié" };
  const ownerId = await resolveAccountOwnerId(user.id);
  let scopeRes = dossierId
    ? await supabase.from("dossiers").select("id, tva_tax_point").eq("id", dossierId).eq("fiduciaire_user_id", ownerId).single()
    : await supabase.from("companies").select("id, tva_tax_point").eq("user_id", ownerId).single();
  const scopeTable = dossierId ? "dossiers" : "companies";
  if (isMissingDatabaseColumn(scopeRes.error, scopeTable, "tva_tax_point")) {
    const legacyScopeRes = dossierId
      ? await supabase.from("dossiers").select("id").eq("id", dossierId).eq("fiduciaire_user_id", ownerId).single()
      : await supabase.from("companies").select("id").eq("user_id", ownerId).single();
    scopeRes = {
      ...legacyScopeRes,
      data: legacyScopeRes.data ? { ...legacyScopeRes.data, tva_tax_point: "cash" } : null,
    } as typeof scopeRes;
  }
  if (scopeRes.error || !scopeRes.data) return { error: scopeRes.error?.message ?? "Périmètre TVA introuvable" };
  const taxPoint: VatTaxPoint = scopeRes.data.tva_tax_point === "debit" ? "debit" : "cash";

  const scope = <T,>(query: T): T => (dossierId
    ? (query as any).eq("dossier_id", dossierId)
    : (query as any).eq("user_id", ownerId).is("dossier_id", null)) as T;
  const periodKey = periodStart.slice(0, 7);
  const invoicesQuery = scope(supabase.from("invoices")
    .select("id, invoice_number, subtotal, tax_rate, tax_amount, total, discount_amount, issue_date, invoice_type, vat_treatment, items, paiements, clients(name)")
    .in("invoice_type", ["facture", "avoir_client"])
    .not("status", "in", '("draft","cancelled")'));
  const expensesQuery = scope(supabase.from("transactions")
    .select("id, description, category, date, amount_ht, tax_rate, tax_amount, fournisseur, if_fournisseur, ice_fournisseur, mode_paiement, date_paiement, compte_comptable")
    .eq("type", "expense")
    .eq("workflow_status", "posted")
    .eq("vat_status", "eligible")
    .or(`and(date_paiement.gte.${periodStart},date_paiement.lte.${periodEnd}),and(date_paiement.is.null,date.gte.${periodStart},date.lte.${periodEnd})`)
    .order("date", { ascending: true }));
  const supplierCreditsQuery = scope(supabase.from("avoirs_fournisseurs")
    .select("tva_amount, tva_rate, compte_comptable")
    .gte("date", periodStart).lte("date", periodEnd));
  const annualInvoicesQuery = scope(supabase.from("invoices")
    .select("subtotal, discount_amount, invoice_type")
    .not("status", "in", '("draft","cancelled")')
    .gte("issue_date", `${periodStart.slice(0, 4)}-01-01`)
    .lte("issue_date", `${periodStart.slice(0, 4)}-12-31`));
  const paymentsQuery = (dossierId
    ? supabase.from("invoice_payments").select("invoice_id, montant, date_paiement, mode_paiement, payment_type, allocation_status").eq("dossier_id", dossierId)
    : supabase.from("invoice_payments").select("invoice_id, montant, date_paiement, mode_paiement, payment_type, allocation_status, invoices!inner(user_id, dossier_id)").eq("invoices.user_id", ownerId).is("invoices.dossier_id", null))
    .eq("allocation_status", "confirmed")
    .eq("payment_type", "encaissement")
    .gte("date_paiement", periodStart).lte("date_paiement", periodEnd);
  const lastDeclarationQuery = dossierId
    ? supabase.from("dossier_tva").select("net_du").eq("dossier_id", dossierId).lt("periode", periodKey).order("periode", { ascending: false }).limit(1)
    : supabase.from("tva_declarations").select("credit_tva, tva_nette_due").eq("user_id", ownerId).lt("period_end", periodStart).order("period_end", { ascending: false }).limit(1);

  const [initialInvRes, initialExpRes, initialAvoirFournisseurRes, lastDeclRes, yearInvRes, cashPaymentsRes] = await Promise.all([
    invoicesQuery, expensesQuery, supplierCreditsQuery, lastDeclarationQuery, annualInvoicesQuery, paymentsQuery,
  ]);
  let invRes = initialInvRes;
  let expRes = initialExpRes;
  let avoirFournisseurRes = initialAvoirFournisseurRes;

  if (isMissingDatabaseColumn(invRes.error, "invoices", "vat_treatment")) {
    invRes = await scope(supabase.from("invoices")
      .select("id, invoice_number, subtotal, tax_rate, tax_amount, total, discount_amount, issue_date, invoice_type, items, paiements, clients(name)")
      .in("invoice_type", ["facture", "avoir_client"])
      .not("status", "in", '("draft","cancelled")')) as typeof invRes;
  }

  if (isUndefinedDatabaseColumn(expRes.error, "transactions")) {
    expRes = await scope(supabase.from("transactions")
      .select("id, description, category, date, amount_ht, tax_rate, tax_amount, compte_comptable, payment_method")
      .eq("type", "expense")
      .gte("date", periodStart).lte("date", periodEnd)
      .order("date", { ascending: true })) as typeof expRes;
  }

  if (isUndefinedDatabaseColumn(avoirFournisseurRes.error, "avoirs_fournisseurs")) {
    avoirFournisseurRes = await scope(supabase.from("avoirs_fournisseurs")
      .select("montant_tva, taux_tva, compte_charge")
      .gte("date_avoir", periodStart).lte("date_avoir", periodEnd)) as typeof avoirFournisseurRes;
  }

  if (invRes.error) return { error: invRes.error.message };
  if (expRes.error) return { error: expRes.error.message };
  if (avoirFournisseurRes.error) return { error: avoirFournisseurRes.error.message };
  if (lastDeclRes.error) return { error: lastDeclRes.error.message };
  if (yearInvRes.error) return { error: yearInvRes.error.message };
  if (cashPaymentsRes.error) return { error: cashPaymentsRes.error.message };

  // ── Section A + B: CA by rate ────────────────────────────────────────────
  const bases: Record<VatRateBucket, number> = { 7: 0, 10: 0, 14: 0, 20: 0 };
  const collectedVat: Record<VatRateBucket, number> = { 7: 0, 10: 0, 14: 0, 20: 0 };
  const zeroRated = {
    out_of_scope: 0,
    exempt_without_deduction: 0,
    exempt_with_deduction: 0,
    suspension: 0,
    unclassified: 0,
  };
  const invoices: TVAInvoiceDetail[] = [];

  const contributions = invoiceVatContributionsForPeriod(
    invRes.data ?? [], cashPaymentsRes.data ?? [], taxPoint, periodStart, periodEnd,
  );
  for (const { invoice: inv, aggregation, ratio } of contributions) {
    for (const rate of [7, 10, 14, 20] as const) {
      bases[rate] += aggregation.bases[rate] * ratio;
      collectedVat[rate] += aggregation.taxes[rate] * ratio;
    }
    for (const treatment of Object.keys(zeroRated) as Array<keyof typeof zeroRated>) {
      zeroRated[treatment] += aggregation.zeroRatedBases[treatment] * ratio;
    }
    if (inv.invoice_type === "facture") invoices.push({
      id: String(inv.id),
      invoice_number: String(inv.invoice_number ?? ""),
      client_name: (inv as any).clients?.name ?? "—",
      issue_date: String(inv.issue_date ?? ""),
      subtotal: Number(inv.subtotal) * Math.abs(ratio),
      tax_rate: Number(inv.tax_rate),
      tax_amount: Number(inv.tax_amount) * Math.abs(ratio),
      total: Number(inv.total) * Math.abs(ratio),
    });
  }

  const ca_7 = roundMoney(bases[7]);
  const ca_10 = roundMoney(bases[10]);
  const ca_14 = roundMoney(bases[14]);
  const ca_20 = roundMoney(bases[20]);
  const ca_hors_champ = roundMoney(zeroRated.out_of_scope);
  const ca_exonere_sans_droit = roundMoney(zeroRated.exempt_without_deduction);
  const ca_exonere_avec_droit = roundMoney(zeroRated.exempt_with_deduction);
  const ca_suspension = roundMoney(zeroRated.suspension);
  const ca_zero_non_classe = roundMoney(zeroRated.unclassified);
  const ca_total = roundMoney(
    ca_7 + ca_10 + ca_14 + ca_20 + ca_hors_champ + ca_exonere_sans_droit
    + ca_exonere_avec_droit + ca_suspension + ca_zero_non_classe,
  );

  // ── Section D: TVA collectée ────────────────────────────────────────────
  const tva_7  = roundMoney(collectedVat[7]);
  const tva_10 = roundMoney(collectedVat[10]);
  const tva_14 = roundMoney(collectedVat[14]);
  const tva_20 = roundMoney(collectedVat[20]);
  const tva_collectee_total = roundMoney(tva_7 + tva_10 + tva_14 + tva_20);

  // ── Section E: Déductions ───────────────────────────────────────────────
  let deductions_charges = 0, deductions_immobilisations = 0;
  const deductions: TVADeductionRow[] = [];

  for (const exp of expRes.data ?? []) {
    const rate = Number((exp as any).tax_rate ?? 0);
    const ht = Number((exp as any).amount_ht ?? 0);
    const tva = Number((exp as any).tax_amount ?? 0);
    if (rate <= 0 || ht <= 0 || tva <= 0) continue;
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
      mode_paiement: (exp as any).mode_paiement ?? (exp as any).payment_method ?? "",
      date_paiement: (exp as any).date_paiement ?? exp.date,
      prorata: 100,
      tva_deductible: tva,
      type_deduction: isImmo ? "immobilisation" : "charge",
    });
  }

  // ── Subtract avoirs fournisseurs from deductions ────────────────────────
  for (const af of avoirFournisseurRes.data ?? []) {
    const tva = Number((af as any).tva_amount ?? (af as any).montant_tva ?? 0);
    const account = (af as any).compte_comptable ?? (af as any).compte_charge;
    const isImmo = account?.startsWith("2") ?? false;
    if (isImmo) deductions_immobilisations = Math.max(0, deductions_immobilisations - tva);
    else deductions_charges = Math.max(0, deductions_charges - tva);
  }

  deductions_charges = roundMoney(deductions_charges);
  deductions_immobilisations = roundMoney(deductions_immobilisations);
  const deductions_total = roundMoney(deductions_charges + deductions_immobilisations);
  const lastDecl = lastDeclRes.data?.[0] as any;
  const credit_reporte = dossierId
    ? Math.max(0, -Number(lastDecl?.net_du ?? 0))
    : Number(lastDecl?.credit_tva ?? 0);

  // ── Droits de timbre ────────────────────────────────────────────────────
  const nb_factures = invoices.length;
  const droits_timbre = calculatePeriodCashReceiptStampDuty(
    cashPaymentsRes.data ?? [],
    invRes.data ?? [],
    periodStart,
    periodEnd,
  );

  // ── Section F ───────────────────────────────────────────────────────────
  const totalDed = deductions_total + credit_reporte;
  const raw = roundMoney(tva_collectee_total + droits_timbre - totalDed);
  const tva_nette_due = roundMoney(Math.max(0, raw));
  const credit_tva    = roundMoney(Math.max(0, -raw));

  // ── Annual ──────────────────────────────────────────────────────────────
  const ca_exercice_annuel = roundMoney(((yearInvRes as any)?.data ?? []).reduce(
    (s: number, inv: any) => s + annualInvoiceTurnover(inv), 0
  ));

  return {
    data: {
      ca_total, ca_hors_champ, ca_exonere_sans_droit, ca_exonere_avec_droit,
      ca_suspension, ca_zero_non_classe, ca_7, ca_10, ca_14, ca_20,
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
  if (params.statut !== "brouillon" && c.ca_zero_non_classe > 0.01) {
    return { error: "Des factures à 0 % n’ont pas de traitement TVA. Classez-les avant de valider la déclaration." };
  }
  const tvaNette = c.tva_collectee_total + params.odTva + c.droits_timbre - c.deductions_total - c.credit_reporte;
  const mois = Number(params.periodStart.slice(5, 7));
  const annee = Number(params.periodStart.slice(0, 4));

  if (params.statut !== "brouillon" && company?.id) {
    const lock = await checkPeriodLocked(mois, annee, company.id);
    if (lock.locked) {
      return {
        error: `La période ${mois}/${annee} est verrouillée.${lock.reason ? ` Motif: ${lock.reason}` : ""}`,
      };
    }
  }

  try {
    const declarationPayload = {
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
    };

    const { data: oldDeclaration } = await supabase
      .from("tva_declarations")
      .select("*")
      .eq("user_id", ownerId)
      .eq("period_start", params.periodStart)
      .eq("period_end", params.periodEnd)
      .maybeSingle();

    const { data: declaration, error } = await supabase.from("tva_declarations").upsert(
      declarationPayload,
      { onConflict: "user_id,period_start,period_end", ignoreDuplicates: false }
    ).select().single();
    if (error) throw error;

    if (declaration) {
      await createVersion(
        "tva_declaration",
        declaration.id,
        declaration as any,
        user.id,
        user.email ?? null,
        oldDeclaration ? "UPDATE" : "CREATE",
        params.statut === "brouillon" ? "Sauvegarde brouillon TVA" : "Validation TVA",
        getDiff(oldDeclaration as any, declaration as any),
      );
      await logAudit({
        userId: user.id,
        userEmail: user.email ?? null,
        companyId: company?.id ?? null,
        action: params.statut === "brouillon" ? "UPDATE" : "APPROVE_TVA",
        entityType: "tva_declaration",
        entityId: declaration.id,
        entityLabel: params.periodLabel,
        oldValues: oldDeclaration as any,
        newValues: declaration as any,
        changedFields: Object.keys(getDiff(oldDeclaration as any, declaration as any)),
      });
    }

    if (declaration && params.statut !== "brouillon" && company?.id) {
      const eventType = params.statut === "déposé" ? "TVA_SUBMITTED" : "TVA_VALIDATED";
      await logAccountingEvent({
        companyId: company.id,
        eventType,
        triggeredBy: user.id,
        triggeredByEmail: user.email ?? null,
        entityType: "tva_declaration",
        entityId: declaration.id,
        amount: Math.max(0, tvaNette),
        periodMois: mois,
        periodAnnee: annee,
        eventData: { declaration, calc: c },
      });
      await lockAccountingPeriod({
        mois,
        annee,
        companyId: company.id,
        lockedBy: user.id,
        lockedByEmail: user.email ?? null,
        reason: `TVA ${params.periodLabel} ${params.statut}`,
        lockType: "hard",
        triggeredByEntity: "tva_declaration",
        triggeredById: declaration.id,
      });
      await logAccountingEvent({
        companyId: company.id,
        eventType: "PERIOD_LOCKED",
        triggeredBy: user.id,
        triggeredByEmail: user.email ?? null,
        entityType: "accounting_period",
        entityId: declaration.id,
        periodMois: mois,
        periodAnnee: annee,
        eventData: { periodLabel: params.periodLabel, reason: `TVA ${params.periodLabel} ${params.statut}` },
      });
    }
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

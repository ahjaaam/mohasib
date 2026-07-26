export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { LayoutTemplate, Download, Lock } from "lucide-react";
import type { JournalCode } from "@/types/fiduciaire";
import EcrituresFilters, { type JournalFilter } from "@/components/EcrituresFilters";
import EcrituresTable, { type EcritureRow } from "@/components/EcrituresTable";

const JOURNAL_LABELS: Record<JournalFilter, string> = {
  ALL: "Tous les journaux",
  VT: "Journal des Ventes",
  AC: "Journal des Achats",
  BQ: "Journal de Banque",
  CA: "Journal de Caisse",
  OD: "Opérations Diverses",
};

const EXPENSE_DEBIT: Record<string, string> = {
  Achats: "6111", Salaires: "6171", Loyer: "6132", Fournitures: "6123",
  Transport: "6142", Communication: "6147", Fiscalité: "6161", Banque: "6311",
  "Autre dépense": "6182",
};
const INCOME_CREDIT: Record<string, string> = {
  Ventes: "7111", Services: "7131", Remboursement: "7311", "Autre revenu": "7131",
};

export default async function DossierEcrituresPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periode?: string; journal?: string; q?: string }>;
}) {
  const { id } = await params;
  const { periode: periodeParam, journal: journalParam, q } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const ownerId = await resolveAccountOwnerId(user.id);

  const { data: dossier } = await supabase
    .from("dossiers")
    .select("id, raison_sociale")
    .eq("id", id)
    .eq("fiduciaire_user_id", ownerId)
    .single();
  if (!dossier) notFound();

  const now = new Date();
  const period = periodeParam ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const journal: JournalFilter = (journalParam as JournalFilter) || "ALL";
  const search = (q ?? "").trim().toLowerCase();
  const base = `/comptable-pro/dossiers/${dossier.id}`;

  const [year, month] = period.split("-");
  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${year}-${month}-${String(lastDay).padStart(2, "0")}`;

  const { data: cloture } = await supabase
    .from("dossier_clotures")
    .select("id")
    .eq("dossier_id", dossier.id)
    .eq("periode", period)
    .maybeSingle();

  const rows: EcritureRow[] = [];

  let savedQuery = supabase
    .from("dossier_ecritures")
    .select("*")
    .eq("dossier_id", dossier.id)
    .eq("periode", period)
    .order("date");
  if (journal !== "ALL") savedQuery = savedQuery.eq("journal", journal);
  const { data: saved } = await savedQuery;

  const savedByJournal = new Map<JournalCode, any[]>();
  for (const e of (saved ?? []) as any[]) {
    const j = e.journal as JournalCode;
    const arr = savedByJournal.get(j) ?? [];
    arr.push(e);
    savedByJournal.set(j, arr);
  }

  function pushSaved(j: JournalCode) {
    for (const e of savedByJournal.get(j) ?? []) {
      rows.push({
        date: e.date,
        numero_piece: e.numero_piece || "",
        compte: e.compte_cgnc || "",
        libelle: e.libelle || "",
        debit: Number(e.debit) || 0,
        credit: Number(e.credit) || 0,
        source: "manuel",
        journal: j,
      });
    }
  }

  const wants = (j: JournalCode) => journal === "ALL" || journal === j;

  if (wants("VT")) {
    if ((savedByJournal.get("VT") ?? []).length > 0) {
      pushSaved("VT");
    } else {
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, invoice_number, issue_date, subtotal, tax_amount, total, clients(name)")
        .eq("dossier_id", dossier.id)
        .gte("issue_date", startDate)
        .lte("issue_date", endDate)
        .order("issue_date");

      for (const inv of (invoices ?? []) as any[]) {
        const client = inv.clients?.name ?? "Client";
        const ref = inv.invoice_number ?? "";
        const ht = Number(inv.subtotal ?? 0);
        const tva = Number(inv.tax_amount ?? 0);
        const ttc = Number(inv.total ?? 0);
        const lib = `${client}${ref ? " — " + ref : ""}`;
        const href = `${base}/invoices/${inv.id}`;
        rows.push({ date: inv.issue_date, numero_piece: ref, compte: "3421", libelle: lib, debit: ttc, credit: 0, source: "facture", journal: "VT", href });
        rows.push({ date: inv.issue_date, numero_piece: ref, compte: "7131", libelle: lib, debit: 0, credit: ht > 0 ? ht : ttc, source: "facture", journal: "VT", href });
        if (tva > 0) rows.push({ date: inv.issue_date, numero_piece: ref, compte: "4455", libelle: `TVA ${ref}`, debit: 0, credit: tva, source: "facture", journal: "VT", href });
      }
    }
  }

  if (wants("AC") || wants("BQ")) {
    const acHasSaved = (savedByJournal.get("AC") ?? []).length > 0;
    const bqHasSaved = (savedByJournal.get("BQ") ?? []).length > 0;
    if (wants("AC")) pushSaved("AC");
    if (wants("BQ")) pushSaved("BQ");

    const acNeedsAuto = wants("AC") && !acHasSaved;
    const bqNeedsAuto = wants("BQ") && !bqHasSaved;
    if (acNeedsAuto || bqNeedsAuto) {
      const { data: txs } = await supabase
        .from("transactions")
        .select("id, date, description, amount, type, category, receipt_id, invoice_id, reference")
        .eq("dossier_id", dossier.id)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      for (const tx of (txs ?? []) as any[]) {
        const amount = Number(tx.amount);
        const txJournal: JournalCode = tx.receipt_id ? "AC" : "BQ";
        if (txJournal === "AC" && !acNeedsAuto) continue;
        if (txJournal === "BQ" && !bqNeedsAuto) continue;
        const href = `${base}/transactions`;
        const source: EcritureRow["source"] = tx.receipt_id ? "document" : "banque";

        const piece = tx.reference ?? "";
        if (tx.receipt_id) {
          const debitCpt = EXPENSE_DEBIT[tx.category ?? ""] ?? "6182";
          rows.push({ date: tx.date, numero_piece: piece, compte: debitCpt, libelle: tx.description, debit: amount, credit: 0, source, journal: txJournal, href });
          rows.push({ date: tx.date, numero_piece: piece, compte: "4411", libelle: tx.description, debit: 0, credit: amount, source, journal: txJournal, href });
        } else if (tx.invoice_id) {
          rows.push({ date: tx.date, numero_piece: piece, compte: "5141", libelle: tx.description, debit: amount, credit: 0, source, journal: txJournal, href });
          rows.push({ date: tx.date, numero_piece: piece, compte: "3421", libelle: tx.description, debit: 0, credit: amount, source, journal: txJournal, href });
        } else if (tx.type === "income") {
          const creditCpt = INCOME_CREDIT[tx.category ?? ""] ?? "7131";
          rows.push({ date: tx.date, numero_piece: piece, compte: "5141", libelle: tx.description, debit: amount, credit: 0, source, journal: txJournal, href });
          rows.push({ date: tx.date, numero_piece: piece, compte: creditCpt, libelle: tx.description, debit: 0, credit: amount, source, journal: txJournal, href });
        } else {
          const debitCpt = EXPENSE_DEBIT[tx.category ?? ""] ?? "6182";
          rows.push({ date: tx.date, numero_piece: piece, compte: debitCpt, libelle: tx.description, debit: amount, credit: 0, source, journal: txJournal, href });
          rows.push({ date: tx.date, numero_piece: piece, compte: "5141", libelle: tx.description, debit: 0, credit: amount, source, journal: txJournal, href });
        }
      }
    }
  }

  if (wants("CA")) pushSaved("CA");
  if (wants("OD")) pushSaved("OD");

  rows.sort((a, b) => a.date.localeCompare(b.date));

  const filteredRows = search
    ? rows.filter((r) =>
        r.numero_piece.toLowerCase().includes(search) ||
        r.compte.toLowerCase().includes(search) ||
        r.libelle.toLowerCase().includes(search))
    : rows;

  const periodLabel = new Date(parseInt(year), parseInt(month) - 1, 1)
    .toLocaleDateString("fr-MA", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,146,74,0.12)" }}>
          <LayoutTemplate size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Écritures</h1>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5 capitalize">Journal des écritures — {dossier.raison_sociale}</p>
        </div>
        {cloture && (
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] font-semibold text-[#065F46] bg-[#D1FAE5] px-3 py-1.5 rounded-lg">
            <Lock size={11} /> Période clôturée
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <EcrituresFilters basePath={`${base}/ecritures`} period={period} journal={journal} search={search} />

        <form action={`${base}/ecritures`} method="get" className="relative flex-1 max-w-[280px]">
          <input type="hidden" name="periode" value={period} />
          <input type="hidden" name="journal" value={journal} />
          <input name="q" defaultValue={search} placeholder="N° Pièce, Compte, Libellé..." className="input py-1.5 text-[12px] w-full" />
        </form>
      </div>

      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#F9F9F6] border-b border-[rgba(0,0,0,0.06)]">
          <span className="text-[12.5px] font-semibold text-[#1A1A2E]">
            {JOURNAL_LABELS[journal]}
            <span className="ml-2 text-[11px] text-[#9CA3AF] font-normal capitalize">{periodLabel}</span>
          </span>
          <Link href={`${base}/export`} className="flex items-center gap-1 text-[12px] font-semibold text-[#C8924A] hover:underline">
            <Download size={12} /> Exporter
          </Link>
        </div>

        <EcrituresTable rows={filteredRows} compteLabel="Compte CGNC" />
      </div>
    </div>
  );
}

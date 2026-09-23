"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { translateError } from "@/lib/errors";
import { Check, Lightbulb, Loader2 } from "lucide-react";
import { isValidAccountingAccountCode, type AccountingSettings } from "@/lib/accounting-settings";
import {
  supplierCreditNoteCounterpartAccount,
  type SupplierCreditNoteAdjustmentType,
} from "@/lib/accounting-engine";
import { finalizeSupplierCreditNote } from "@/lib/supplier-credit-note-booking-client";

const TVA_RATES = [0, 7, 10, 14, 20];

const ADJUSTMENT_TYPES: Array<{ value: SupplierCreditNoteAdjustmentType; label: string }> = [
  { value: "commercial_reduction", label: "Remise, rabais ou ristourne hors facture" },
  { value: "purchase_return", label: "Retour de marchandise" },
  { value: "invoice_correction", label: "Correction de facturation" },
  { value: "partial_cancellation", label: "Annulation partielle" },
  { value: "settlement_discount", label: "Escompte de règlement" },
  { value: "other", label: "Autre correction" },
];

interface OriginalPurchaseOption {
  id: string;
  reference: string;
  supplier: string;
  date: string;
  account: string;
}

interface Props {
  nextNumber: string;
  userId: string;
  dossierId?: string;
  backHref?: string;
  supplierAccount?: string;
  accountingSettings: AccountingSettings;
  originalPurchases?: OriginalPurchaseOption[];
}

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}

export default function NewAvoirFournisseurForm({
  nextNumber,
  userId,
  dossierId,
  backHref,
  supplierAccount = "4411",
  accountingSettings,
  originalPurchases = [],
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    numero_interne: nextNumber,
    fournisseur: "",
    ref_fournisseur: "",
    date: today,
    adjustment_type: "commercial_reduction" as SupplierCreditNoteAdjustmentType,
    linked_receipt_id: "",
    original_purchase_account: "6111",
    montant_ht: "",
    tva_rate: 20,
    compte_comptable: supplierAccount,
    notes: "",
  });

  const montantHt = parseFloat(form.montant_ht.replace(",", ".")) || 0;
  const tvaAmount = montantHt * form.tva_rate / 100;
  const total = montantHt + tvaAmount;
  const counterpartAccount = supplierCreditNoteCounterpartAccount(
    form.adjustment_type,
    form.original_purchase_account,
    accountingSettings,
  );

  async function save() {
    if (!form.fournisseur.trim()) { setError("Le nom du fournisseur est requis."); return; }
    if (montantHt <= 0) { setError("Le montant HT doit être supérieur à 0."); return; }
    if (!isValidAccountingAccountCode(form.original_purchase_account, [2, 6])) {
      setError("Le compte d’achat ou d’immobilisation d’origine est requis.");
      return;
    }

    setSaving(true);
    setError(null);

    const { data: creditNote, error: err } = await supabase
      .from("avoirs_fournisseurs")
      .insert({
        user_id: userId,
        ...(dossierId ? { dossier_id: dossierId } : {}),
        numero_interne: form.numero_interne,
        ref_fournisseur: form.ref_fournisseur || null,
        fournisseur: form.fournisseur,
        date: form.date,
        montant_ht: montantHt,
        tva_rate: form.tva_rate,
        tva_amount: tvaAmount,
        total,
        motif: ADJUSTMENT_TYPES.find(item => item.value === form.adjustment_type)?.label,
        compte_comptable: form.compte_comptable,
        statut: "brouillon",
        adjustment_type: form.adjustment_type,
        original_purchase_account: form.original_purchase_account,
        linked_receipt_id: form.linked_receipt_id || null,
        notes: form.notes || null,
      })
      .select("id")
      .single();

    if (err) {
      setSaving(false);
      setError(translateError(err));
    } else {
      try {
        await finalizeSupplierCreditNote(creditNote.id, dossierId);
        toast.success(`Avoir ${form.numero_interne} comptabilisé`);
        router.push(backHref ?? "/transactions?mode=avoirs");
        router.refresh();
      } catch (bookingError) {
        const message = bookingError instanceof Error ? bookingError.message : translateError(bookingError);
        setError(`${message} L’avoir a été conservé en brouillon.`);
      } finally {
        setSaving(false);
      }
    }
  }

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-[18px]">
      <div className="alert-blue mb-4">
        <Lightbulb size={14} className="inline mr-1.5 -mt-0.5" />Un avoir fournisseur débite le compte fournisseur, annule la TVA récupérable et crédite le compte déterminé par sa nature.
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="col-span-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.6px] pb-2 border-b border-[rgba(0,0,0,0.08)]">
          Informations de l&apos;avoir
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">N° Interne</label>
          <input
            className="input"
            value={form.numero_interne}
            onChange={(e) => setForm((f) => ({ ...f, numero_interne: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Date</label>
          <input
            type="date" className="input"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Fournisseur *</label>
          <input
            className="input"
            placeholder="Nom du fournisseur"
            value={form.fournisseur}
            onChange={(e) => setForm((f) => ({ ...f, fournisseur: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Réf. fournisseur (optionnel)</label>
          <input
            className="input"
            placeholder="N° avoir du fournisseur"
            value={form.ref_fournisseur}
            onChange={(e) => setForm((f) => ({ ...f, ref_fournisseur: e.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Montant HT *</label>
          <div className="flex items-center gap-2">
            <input
              type="number" min={0} step={0.01} className="input flex-1"
              placeholder="0,00"
              value={form.montant_ht}
              onChange={(e) => setForm((f) => ({ ...f, montant_ht: e.target.value }))}
            />
            <span className="text-[11.5px] text-[#6B7280] flex-shrink-0">MAD</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Taux TVA</label>
          <select
            className="input"
            value={form.tva_rate}
            onChange={(e) => setForm((f) => ({ ...f, tva_rate: Number(e.target.value) }))}
          >
            {TVA_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Compte fournisseur</label>
          <input
            className="input"
            value={form.compte_comptable}
            onChange={(e) => setForm((f) => ({ ...f, compte_comptable: e.target.value }))}
          />
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Facture d’achat d’origine (recommandé)</label>
          <select
            className="input"
            value={form.linked_receipt_id}
            onChange={(e) => {
              const purchase = originalPurchases.find(item => item.id === e.target.value);
              setForm((current) => ({
                ...current,
                linked_receipt_id: e.target.value,
                fournisseur: purchase?.supplier ?? current.fournisseur,
                original_purchase_account: purchase?.account ?? current.original_purchase_account,
              }));
            }}
          >
            <option value="">Aucune facture liée</option>
            {originalPurchases.map(purchase => (
              <option key={purchase.id} value={purchase.id}>
                {purchase.reference} — {purchase.supplier} — {purchase.date}
              </option>
            ))}
          </select>
        </div>

        {/* Nature */}
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Nature comptable</label>
          <div className="flex flex-wrap gap-2">
            {ADJUSTMENT_TYPES.map((item) => (
              <button
                key={item.value} type="button"
                onClick={() => setForm((f) => ({ ...f, adjustment_type: item.value }))}
                className={`px-3 py-1.5 rounded-lg text-[12px] border transition-all ${
                  form.adjustment_type === item.value
                    ? "bg-[#7C3AED] text-white border-[#7C3AED]"
                    : "bg-white text-[#6B7280] border-[rgba(0,0,0,0.12)] hover:border-[#7C3AED] hover:text-[#7C3AED]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Compte d’origine *</label>
          <input
            className="input font-mono"
            value={form.original_purchase_account}
            onChange={(e) => setForm((f) => ({ ...f, original_purchase_account: e.target.value.trim() }))}
            placeholder="6111, 6121, 6141, 2350…"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Compte crédité</label>
          <input className="input font-mono bg-[#F9FAFB]" value={counterpartAccount} readOnly />
        </div>

        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Notes (optionnel)</label>
          <textarea
            className="input resize-none" rows={2}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="Informations complémentaires..."
          />
        </div>
      </div>

      {/* Totals */}
      <div className="totals-box">
        <div className="total-row">
          <span>Montant HT</span>
          <span className="text-[#7C3AED]">- {fmt(montantHt)}</span>
        </div>
        <div className="total-row">
          <span>TVA ({form.tva_rate}%)</span>
          <span className="text-[#7C3AED]">- {fmt(tvaAmount)}</span>
        </div>
        <div className="total-row grand">
          <span>Total TTC à déduire</span>
          <span className="text-[#7C3AED]">- {fmt(total)}</span>
        </div>
        <div className="total-row">
          <span>Écriture</span>
          <span className="font-mono">Débit {form.compte_comptable} · Crédit {counterpartAccount}{tvaAmount > 0 ? " / 3455" : ""}</span>
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] rounded-lg px-3 py-2 mt-3">{error}</p>
      )}

      <div className="flex gap-2 mt-4">
        <button
          onClick={() => router.push(backHref ?? "/transactions?mode=avoirs")}
          className="btn btn-outline"
        >
          Annuler
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="btn flex items-center gap-1.5 disabled:opacity-60"
          style={{ background: "#7C3AED", color: "white", borderColor: "#7C3AED" }}
        >
          {saving
            ? <><Loader2 size={13} className="animate-spin" /> Enregistrement...</>
            : <><Check size={13} /> Comptabiliser l&apos;avoir</>}
        </button>
      </div>
    </div>
  );
}

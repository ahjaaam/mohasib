"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateError } from "@/lib/errors";
import { Save, Trash2, Plus, Upload } from "lucide-react";
import type { Client } from "@/types";
import { computeInvoiceDiscount, DISCOUNT_LABELS, type DiscountMode, type DiscountType } from "@/lib/invoice-discounts";

interface LineItem {
  desc: string;
  qty: number;
  pu: number;
  tva: number;
}

const TVA_RATES = [0, 7, 10, 14, 20];

function fmt(n: number) { return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD"; }

function toLines(items: any[]): LineItem[] {
  return items.map((item) => ({
    desc: item.description ?? "",
    qty: item.quantity ?? 1,
    pu: item.unit_price ?? 0,
    tva: item.tva_rate ?? 20,
  }));
}

export default function EditInvoiceForm({
  invoice,
  clients,
  backHref,
}: {
  invoice: any;
  clients: Pick<Client, "id" | "name" | "email">[];
  backHref?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    num: invoice.invoice_number ?? "",
    client_id: invoice.client_id ?? "",
    date: invoice.issue_date ?? "",
    due: invoice.due_date ?? "",
  });

  const [lines, setLines] = useState<LineItem[]>(
    invoice.items?.length ? toLines(invoice.items) : [{ desc: "", qty: 1, pu: 0, tva: 20 }]
  );
  const [discountType, setDiscountType] = useState<DiscountType>(invoice.discount_type ?? "none");
  const [discountMode, setDiscountMode] = useState<DiscountMode>(invoice.discount_mode ?? "percent");
  const [discountValue, setDiscountValue] = useState(Number(invoice.discount_value ?? 0));
  const [showDiscount, setShowDiscount] = useState(Boolean(invoice.discount_type && invoice.discount_type !== "none"));

  function addDiscount() {
    setShowDiscount(true);
    if (discountType === "none") setDiscountType("remise_commerciale");
  }

  function removeDiscount() {
    setShowDiscount(false);
    setDiscountType("none");
    setDiscountMode("percent");
    setDiscountValue(0);
  }

  function updateLine(i: number, field: keyof LineItem, val: string | number) {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: field === "desc" ? val : Number(val) };
      return next;
    });
  }

  const lineAmounts = lines.map((l) => ({ ht: l.qty * l.pu, tva: l.qty * l.pu * l.tva / 100 }));
  const totalHT = lineAmounts.reduce((s, l) => s + l.ht, 0);
  const grossTVA = lineAmounts.reduce((s, l) => s + l.tva, 0);
  const discountTotals = computeInvoiceDiscount({ grossSubtotal: totalHT, grossTax: grossTVA, type: discountType, mode: discountMode, value: discountValue });
  const totalTVA = discountTotals.taxAmount;
  const totalTTC = discountTotals.total;

  async function save(status: "draft" | "sent") {
    if (discountType !== "none" && (discountValue <= 0 || (discountMode === "percent" && discountValue > 100) || (discountMode === "amount" && discountValue > totalHT))) {
      setError("La réduction doit être supérieure à 0 et ne peut pas dépasser le total HT.");
      return;
    }
    setSaving(true);
    setError(null);

    const items = lines.map((l) => ({
      description: l.desc,
      quantity: l.qty,
      unit_price: l.pu,
      tva_rate: l.tva,
      amount: l.qty * l.pu,
    }));

    const avgTVA = totalHT > 0 ? (grossTVA / totalHT) * 100 : 20;

    const { error: err } = await supabase.from("invoices").update({
      client_id: form.client_id || null,
      invoice_number: form.num,
      status,
      issue_date: form.date,
      due_date: form.due || null,
      subtotal: totalHT,
      tax_rate: Math.round(avgTVA * 100) / 100,
      tax_amount: totalTVA,
      total: totalTTC,
      discount_type: discountType === "none" ? null : discountType,
      discount_mode: discountType === "none" ? null : discountMode,
      discount_value: discountType === "none" ? 0 : discountValue,
      discount_amount: discountTotals.discountAmount,
      items,
    }).eq("id", invoice.id);

    setSaving(false);
    if (err) { setError(translateError(err)); }
    else { router.push(backHref ? `${backHref}/${invoice.id}` : `/factures/${invoice.id}`); router.refresh(); }
  }

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-[18px]">
      {/* Header fields */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="col-span-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.6px] pb-2 border-b border-[rgba(0,0,0,0.08)]">
          Modifier la facture
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">N° Facture</label>
          <input className="input" value={form.num} onChange={(e) => setForm((f) => ({ ...f, num: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Date</label>
          <input type="date" className="input" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Client</label>
          <select className="input" value={form.client_id} onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
            <option value="">Sélectionner un client...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Date d&apos;échéance</label>
          <input type="date" className="input" value={form.due} onChange={(e) => setForm((f) => ({ ...f, due: e.target.value }))} />
        </div>
      </div>

      {/* Line items */}
      <div className="mt-4">
        <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: "2fr 58px 90px 76px 28px" }}>
          {["Description", "Qté", "P.U. HT", "TVA %", ""].map((h) => (
            <span key={h} className="text-[10.5px] text-[#6B7280] font-semibold uppercase tracking-[0.5px]">{h}</span>
          ))}
        </div>

        {lines.map((line, i) => (
          <div key={i} className="grid gap-1.5 mb-1.5 items-center" style={{ gridTemplateColumns: "2fr 58px 90px 76px 28px" }}>
            <input className="input" placeholder="Description de la prestation..." value={line.desc}
              onChange={(e) => updateLine(i, "desc", e.target.value)} />
            <input type="number" min={1} className="input text-right" value={line.qty}
              onChange={(e) => updateLine(i, "qty", e.target.value)} />
            <input type="number" min={0} step={0.01} className="input text-right" placeholder="0" value={line.pu || ""}
              onChange={(e) => updateLine(i, "pu", e.target.value)} />
            <select className="input" value={line.tva} onChange={(e) => updateLine(i, "tva", e.target.value)}>
              {TVA_RATES.map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
            <button type="button" onClick={() => lines.length > 1 && setLines((p) => p.filter((_, j) => j !== i))}
              className="flex items-center justify-center w-7 h-7 rounded bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FCA5A5] transition-colors disabled:opacity-40"
              disabled={lines.length === 1}>
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        <button type="button" onClick={() => setLines((p) => [...p, { desc: "", qty: 1, pu: 0, tva: 20 }])}
          className="text-[11.5px] text-[#6B7280] hover:text-[#C8924A] bg-none border-none cursor-pointer mt-1 flex items-center gap-1">
          <Plus size={13} /> Ajouter une ligne
        </button>
      </div>

      <div className="mt-3">
        {!showDiscount ? (
          <button type="button" aria-expanded="false" onClick={addDiscount} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#6B7280] hover:text-[#C8924A]">
            <Plus size={12} /> Ajouter une réduction ou un escompte
          </button>
        ) : (
          <div className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#FAFAF6] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.6px] text-[#6B7280]">Réduction facultative</div>
              <button type="button" onClick={removeDiscount} className="text-[10.5px] font-medium text-[#9CA3AF] hover:text-[#DC2626]">Retirer</button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-[#6B7280]">Nature</span>
                <select className="input" value={discountType} onChange={event => setDiscountType(event.target.value as DiscountType)}>
                  {Object.entries(DISCOUNT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-[#6B7280]">Calcul</span>
                <select className="input" value={discountMode} disabled={discountType === "none"} onChange={event => setDiscountMode(event.target.value as DiscountMode)}>
                  <option value="percent">Pourcentage</option>
                  <option value="amount">Montant HT</option>
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] font-medium text-[#6B7280]">{discountMode === "percent" ? "Taux (%)" : "Montant HT (MAD)"}</span>
                <input type="number" min="0" max={discountMode === "percent" ? 100 : undefined} step="0.01" className="input" disabled={discountType === "none"} value={discountType === "none" ? "" : discountValue || ""} onChange={event => setDiscountValue(Number(event.target.value))} placeholder="0" />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="totals-box">
        <div className="total-row"><span>Total HT brut</span><span>{fmt(totalHT)}</span></div>
        {discountTotals.discountAmount > 0 && <div className="total-row text-[#7C3AED]"><span>{DISCOUNT_LABELS[discountType]}</span><span>− {fmt(discountTotals.discountAmount)}</span></div>}
        {discountTotals.discountAmount > 0 && <div className="total-row"><span>Net HT</span><span>{fmt(discountTotals.netSubtotal)}</span></div>}
        <div className="total-row"><span>TVA</span><span>{fmt(totalTVA)}</span></div>
        <div className="total-row grand"><span>Total TTC</span><span>{fmt(totalTTC)}</span></div>
      </div>

      {error && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] rounded-lg px-3 py-2 mt-3">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2 mt-4 flex-wrap">
        <button onClick={() => save("draft")} disabled={saving} className="btn btn-outline">
          <Save size={13} /> {saving ? "..." : "Enregistrer brouillon"}
        </button>
        <button onClick={() => save("sent")} disabled={saving} className="btn btn-gold">
          {saving ? "..." : <><Upload size={13} /> Marquer comme envoyée</>}
        </button>
        <button type="button" onClick={() => router.back()} className="btn btn-outline">
          ← Annuler
        </button>
      </div>
    </div>
  );
}

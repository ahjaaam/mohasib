"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Trash2, Plus, Loader2, Send } from "lucide-react";
import type { Client } from "@/types";

interface LineItem {
  desc: string;
  qty: number;
  pu: number;
  tva: number;
}

interface Props {
  clients: Pick<Client, "id" | "name" | "email">[];
  nextNumber: string;
  userId: string;
}

const TVA_RATES = [0, 7, 10, 14, 20];

function emptyLine(): LineItem {
  return { desc: "", qty: 1, pu: 0, tva: 20 };
}

function fmt(n: number) { return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD"; }

export default function NewInvoiceForm({ clients, nextNumber, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; number: string } | null>(null);
  const [waState, setWaState] = useState<"idle" | "loading" | "success" | "error">("idle");

  const today = new Date().toISOString().split("T")[0];

  const DELAY_DAYS: Record<string, number> = {
    "Immédiat": 0,
    "15 jours": 15,
    "30 jours": 30,
    "45 jours": 45,
    "60 jours": 60,
  };

  function calcDueDate(delayLabel: string | null | undefined): string {
    const days = DELAY_DAYS[delayLabel ?? ""] ?? 30;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  }

  const [form, setForm] = useState({
    num: nextNumber,
    client_id: "",
    date: today,
    due: calcDueDate(null), // will be updated by useEffect
  });

  useEffect(() => {
    supabase
      .from("companies")
      .select("invoice_payment_delay")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data?.invoice_payment_delay) {
          setForm(f => ({ ...f, due: calcDueDate(data.invoice_payment_delay) }));
        }
      });
  }, [userId]);

  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  function updateLine(i: number, field: keyof LineItem, val: string | number) {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: field === "desc" ? val : Number(val) };
      return next;
    });
  }

  const lineAmounts = lines.map((l) => ({ ht: l.qty * l.pu, tva: l.qty * l.pu * l.tva / 100 }));
  const totalHT = lineAmounts.reduce((s, l) => s + l.ht, 0);
  const totalTVA = lineAmounts.reduce((s, l) => s + l.tva, 0);
  const totalTTC = totalHT + totalTVA;

  async function save(status: "draft" | "sent") {
    setSaving(true);
    setError(null);

    const items = lines.map((l) => ({
      description: l.desc,
      quantity: l.qty,
      unit_price: l.pu,
      tva_rate: l.tva,
      amount: l.qty * l.pu,
    }));

    // Use weighted avg TVA rate for the record
    const avgTVA = totalHT > 0 ? (totalTVA / totalHT) * 100 : 20;

    const { data: row, error: err } = await supabase
      .from("invoices")
      .insert({
        user_id: userId,
        client_id: form.client_id || null,
        invoice_number: form.num,
        status,
        issue_date: form.date,
        due_date: form.due || null,
        subtotal: totalHT,
        tax_rate: Math.round(avgTVA * 100) / 100,
        tax_amount: totalTVA,
        total: totalTTC,
        currency: "MAD",
        items,
      })
      .select("id, invoice_number")
      .single();

    setSaving(false);
    if (err) { setError(err.message); }
    else { setCreated({ id: row.id, number: row.invoice_number }); }
  }

  async function sendWhatsApp(invoiceId: string) {
    setWaState("loading");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const { whatsappUrl } = await res.json();
      window.open(whatsappUrl, "_blank");
      setWaState("success");
      toast.success("WhatsApp ouvert avec la facture 📲");
      setTimeout(() => { router.push("/invoices"); router.refresh(); }, 1500);
    } catch (e: any) {
      setWaState("error");
      toast.error(e.message || "Erreur WhatsApp", { duration: 5000 });
      setTimeout(() => setWaState("idle"), 2500);
    }
  }

  // Success screen shown after invoice is created
  if (created) {
    return (
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-8 flex flex-col items-center text-center gap-4">
        <div className="text-4xl">🎉</div>
        <div>
          <p className="text-[15px] font-semibold text-[#1A1A2E]">Facture créée !</p>
          <p className="text-[12.5px] text-[#6B7280] mt-0.5">
            Facture <span className="font-medium text-[#1A1A2E]">{created.number}</span> enregistrée avec succès.
          </p>
        </div>
        <p className="text-[12px] text-[#6B7280]">Envoyer maintenant par WhatsApp ?</p>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
          <button
            onClick={() => sendWhatsApp(created.id)}
            disabled={waState === "loading" || waState === "success"}
            className={`btn flex-1 justify-center flex items-center gap-1.5 ${
              waState === "success"
                ? "bg-[#059669] text-white border-[#059669]"
                : waState === "error"
                ? "bg-[#DC2626] text-white border-[#DC2626]"
                : "btn-gold"
            }`}
          >
            {waState === "loading" && <><Loader2 size={13} className="animate-spin" /> Préparation...</>}
            {waState === "success" && <>✓ WhatsApp ouvert</>}
            {waState === "error" && <>❌ Réessayer</>}
            {waState === "idle" && <><Send size={13} /> Envoyer par WhatsApp</>}
          </button>
          <button
            onClick={() => { router.push(`/invoices/${created.id}`); router.refresh(); }}
            className="btn btn-outline flex-1 justify-center"
          >
            Voir la facture
          </button>
        </div>
        <button
          onClick={() => { router.push("/invoices"); router.refresh(); }}
          className="text-[11.5px] text-[#6B7280] hover:text-[#1A1A2E] underline"
        >
          Retour aux factures
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-[18px]">
      <div className="alert-blue">
        💡 ICE, IF, RC, CNSS et mentions légales marocaines inclus automatiquement dans le PDF généré.
      </div>

      {/* Header fields */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="col-span-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.6px] pb-2 border-b border-[rgba(0,0,0,0.08)]">
          Informations de la facture
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

        <button type="button" onClick={() => setLines((p) => [...p, emptyLine()])}
          className="text-[11.5px] text-[#6B7280] hover:text-[#C8924A] bg-none border-none cursor-pointer mt-1 flex items-center gap-1">
          <Plus size={13} /> Ajouter une ligne
        </button>
      </div>

      {/* Totals */}
      <div className="totals-box">
        <div className="total-row"><span>Total HT</span><span>{fmt(totalHT)}</span></div>
        <div className="total-row"><span>TVA</span><span>{fmt(totalTVA)}</span></div>
        <div className="total-row grand"><span>Total TTC</span><span>{fmt(totalTTC)}</span></div>
      </div>

      {error && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] rounded-lg px-3 py-2 mt-3">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2 mt-4 flex-wrap">
        <button onClick={() => save("draft")} disabled={saving} className="btn btn-outline">
          💾 {saving ? "..." : "Enregistrer brouillon"}
        </button>
        <button onClick={() => save("sent")} disabled={saving} className="btn btn-gold">
          {saving ? "..." : "✓ Créer et envoyer"}
        </button>
      </div>
    </div>
  );
}

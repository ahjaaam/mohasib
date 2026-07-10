"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { translateError } from "@/lib/errors";
import { Trash2, Plus, Loader2, Send, Mail, Download, Save } from "lucide-react";
import type { Client } from "@/types";

interface LineItem {
  desc: string;
  qty: number;
  pu: number;
  tva: number;
}

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  unit_price: number | string;
  tva_rate: number | string;
  is_active: boolean;
}

interface Props {
  clients: Pick<Client, "id" | "name" | "email">[];
  nextNumber: string;
  userId: string;
  dossierId?: string;
  backHref?: string;
}

const TVA_RATES = [0, 7, 10, 14, 20];

function emptyLine(): LineItem {
  return { desc: "", qty: 1, pu: 0, tva: 20 };
}

function fmt(n: number) { return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD"; }

export default function NewInvoiceForm({ clients, nextNumber, userId, dossierId, backHref }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; number: string } | null>(null);
  const [waState, setWaState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [emailState, setEmailState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "error">("idle");
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState("");

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

  useEffect(() => {
    supabase
      .from("invoice_items_catalog")
      .select("id, name, description, unit_price, tva_rate, is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setCatalogItems((data ?? []) as CatalogItem[]));
  }, [userId]);

  const [lines, setLines] = useState<LineItem[]>([emptyLine()]);

  function updateLine(i: number, field: keyof LineItem, val: string | number) {
    setLines((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], [field]: field === "desc" ? val : Number(val) };
      return next;
    });
  }

  function addCatalogItem(itemId: string) {
    const item = catalogItems.find((catalogItem) => catalogItem.id === itemId);
    if (!item) return;
    const nextLine: LineItem = {
      desc: item.description || item.name,
      qty: 1,
      pu: Number(item.unit_price || 0),
      tva: Number(item.tva_rate || 0),
    };
    setLines((prev) => {
      const firstEmptyIndex = prev.findIndex((line) => !line.desc.trim() && Number(line.pu || 0) === 0);
      if (firstEmptyIndex >= 0) {
        const next = [...prev];
        next[firstEmptyIndex] = nextLine;
        return next;
      }
      return [...prev, nextLine];
    });
    setSelectedCatalogItem("");
  }

  async function saveLineAsCatalogItem(line: LineItem) {
    if (!line.desc.trim()) {
      toast.error("Description requise pour enregistrer l’article");
      return;
    }
    const { error } = await supabase.from("invoice_items_catalog").insert({
      user_id: userId,
      name: line.desc.trim().slice(0, 90),
      description: line.desc.trim(),
      unit_price: Number(line.pu || 0),
      tva_rate: Number(line.tva || 0),
      unit: "unité",
      is_active: true,
    });
    if (error) toast.error(translateError(error));
    else {
      toast.success("Ligne enregistrée dans vos articles");
      const { data } = await supabase
        .from("invoice_items_catalog")
        .select("id, name, description, unit_price, tva_rate, is_active")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("name");
      setCatalogItems((data ?? []) as CatalogItem[]);
    }
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
        ...(dossierId ? { dossier_id: dossierId } : {}),
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
    if (err) { setError(translateError(err)); }
    else {
      if (dossierId) {
        await supabase.from("dossiers").update({ derniere_ecriture: new Date().toISOString() }).eq("id", dossierId);
      }
      // Fire-and-forget: book the invoice as journal entries
      fetch("/api/accounting/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "invoice", invoiceId: row.id, dossierId }),
      }).catch(() => {});
      if (status === "draft") { router.push(backHref ?? "/invoices"); router.refresh(); }
      else { setCreated({ id: row.id, number: row.invoice_number }); }
    }
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
      setTimeout(() => { router.push(backHref ?? "/invoices"); router.refresh(); }, 1500);
    } catch (e: any) {
      setWaState("error");
      toast.error(translateError(e), { duration: 5000 });
      setTimeout(() => setWaState("idle"), 2500);
    }
  }

  async function sendEmail(invoiceId: string) {
    setEmailState("loading");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send-email`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.message || body?.error || `HTTP ${res.status}`);
      }
      setEmailState("success");
      toast.success("Facture envoyée par email");
      setTimeout(() => setEmailState("idle"), 2500);
    } catch (e: any) {
      setEmailState("error");
      toast.error(translateError(e), { duration: 5000 });
      setTimeout(() => setEmailState("idle"), 2500);
    }
  }

  async function downloadPDF(invoiceId: string) {
    setPdfState("loading");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      a.href = url;
      a.download = match ? match[1] : `${created?.number ?? "facture"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setPdfState("idle");
    } catch (e: any) {
      setPdfState("error");
      toast.error(translateError(e), { duration: 5000 });
      setTimeout(() => setPdfState("idle"), 2500);
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
        <p className="text-[12px] text-[#6B7280]">Partager ou télécharger la facture maintenant.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-2xl">
          <button
            onClick={() => sendWhatsApp(created.id)}
            disabled={waState === "loading" || waState === "success"}
            className={`btn justify-center flex items-center gap-1.5 ${
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
            onClick={() => sendEmail(created.id)}
            disabled={emailState === "loading" || emailState === "success"}
            className={`btn justify-center flex items-center gap-1.5 ${
              emailState === "success"
                ? "bg-[#059669] text-white border-[#059669]"
                : emailState === "error"
                ? "bg-[#DC2626] text-white border-[#DC2626]"
                : "border border-[#0D1526] bg-[#0D1526] text-white hover:bg-[#1A2540]"
            }`}
          >
            {emailState === "loading" && <><Loader2 size={13} className="animate-spin" /> Envoi...</>}
            {emailState === "success" && <>✓ Email envoyé</>}
            {emailState === "error" && <>Réessayer email</>}
            {emailState === "idle" && <><Mail size={13} /> Envoyer par email</>}
          </button>
          <button
            onClick={() => downloadPDF(created.id)}
            disabled={pdfState === "loading"}
            className={`btn justify-center flex items-center gap-1.5 ${
              pdfState === "error"
                ? "bg-[#DC2626] text-white border-[#DC2626]"
                : "border border-[#6B7280] bg-[#6B7280] text-white hover:bg-[#4B5563]"
            }`}
          >
            {pdfState === "loading" && <><Loader2 size={13} className="animate-spin" /> Téléchargement...</>}
            {pdfState === "error" && <>Réessayer PDF</>}
            {pdfState === "idle" && <><Download size={13} /> Télécharger la facture</>}
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full max-w-xs">
          <button
            onClick={() => { router.push(`${backHref ?? "/invoices"}/${created.id}`); router.refresh(); }}
            className="btn btn-outline flex-1 justify-center"
          >
            Voir la facture
          </button>
        </div>
        <button
          onClick={() => { router.push(backHref ?? "/invoices"); router.refresh(); }}
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
        {catalogItems.length > 0 && (
          <div className="mb-3 rounded-lg border border-[rgba(200,146,74,0.18)] bg-[#FFF7ED] p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-[11px] font-semibold text-[#9A672E]">Ajouter un article enregistré</span>
                <select
                  className="input bg-white"
                  value={selectedCatalogItem}
                  onChange={(e) => setSelectedCatalogItem(e.target.value)}
                >
                  <option value="">Sélectionner un article ou une prestation...</option>
                  {catalogItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {Number(item.unit_price || 0).toLocaleString("fr-MA", { minimumFractionDigits: 2 })} MAD HT · TVA {Number(item.tva_rate || 0)}%
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => selectedCatalogItem && addCatalogItem(selectedCatalogItem)}
                disabled={!selectedCatalogItem}
                className="btn btn-gold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-1.5 mb-1.5" style={{ gridTemplateColumns: "2fr 58px 90px 76px 28px" }}>
          {["Description", "Qté", "P.U. HT", "TVA %", ""].map((h) => (
            <span key={h} className="text-[10.5px] text-[#6B7280] font-semibold uppercase tracking-[0.5px]">{h}</span>
          ))}
        </div>

        {lines.map((line, i) => (
          <div key={i} className="mb-2">
            <div className="grid gap-1.5 items-center" style={{ gridTemplateColumns: "2fr 58px 90px 76px 28px" }}>
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
            {(line.desc.trim() || Number(line.pu || 0) > 0) && (
              <button
                type="button"
                onClick={() => saveLineAsCatalogItem(line)}
                className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#9A672E] hover:text-[#C8924A]"
              >
                <Save size={11} /> Enregistrer cette ligne comme article
              </button>
            )}
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
        <button onClick={() => save("draft")} disabled={saving} className="btn border border-[#0D1526] bg-[#0D1526] text-white hover:bg-[#1A2540]">
          {saving ? "..." : "Enregistrer brouillon"}
        </button>
        <button onClick={() => save("sent")} disabled={saving} className="btn btn-gold">
          {saving ? "..." : "Créer et envoyer"}
        </button>
      </div>
    </div>
  );
}

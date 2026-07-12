"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { translateError } from "@/lib/errors";
import { getAvailableInvoiceDocumentNumber, getNextInvoiceDocumentNumber } from "@/lib/document-numbers";
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
}

const TVA_RATES = [0, 7, 10, 14, 20];

function emptyLine(): LineItem {
  return { desc: "", qty: 1, pu: 0, tva: 20 };
}

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}

function calcExpiry(issueDate: string, validityDays: number): string {
  const d = new Date(issueDate);
  d.setDate(d.getDate() + validityDays);
  return d.toISOString().split("T")[0];
}

export default function NewDevisForm({ clients, nextNumber, userId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ id: string; number: string; clientEmail?: string | null } | null>(null);
  const [waState, setWaState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [emailState, setEmailState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pdfState, setPdfState] = useState<"idle" | "loading" | "error">("idle");
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState({
    num: nextNumber,
    client_id: "",
    date: today,
    validity_days: 30,
    objet: "",
    conditions: "",
    notes: "",
  });

  const expiryDate = calcExpiry(form.date, form.validity_days);

  useEffect(() => {
    supabase
      .from("companies")
      .select("devis_validity_days, devis_conditions_defaut")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm(f => ({
            ...f,
            validity_days: data.devis_validity_days ?? 30,
            conditions: data.devis_conditions_defaut ?? "",
          }));
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

  function isDuplicateInvoiceNumberError(err: any) {
    const text = `${err?.code ?? ""} ${err?.message ?? ""} ${err?.details ?? ""}`;
    return text.includes("23505") || text.includes("idx_invoices_number") || /duplicate key/i.test(text);
  }

  async function save(devisStatus: "brouillon" | "envoyé") {
    if (totalHT <= 0) {
      setError("Le montant du devis doit être supérieur à 0. Sélectionnez un article du catalogue ou ajoutez une ligne avec un prix.");
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

    const avgTVA = totalHT > 0 ? (totalTVA / totalHT) * 100 : 20;

    let invoiceNumber = await getAvailableInvoiceDocumentNumber(supabase, {
      preferredNumber: form.num,
      prefix: "DEV",
      userId,
    });

    if (invoiceNumber !== form.num) {
      setForm((f) => ({ ...f, num: invoiceNumber }));
    }

    const insertDevis = (number: string) => supabase
        .from("invoices")
        .insert({
          user_id: userId,
          client_id: form.client_id || null,
          invoice_number: number,
          invoice_type: "devis",
          status: "draft",
          devis_status: devisStatus,
          devis_objet: form.objet || null,
          devis_validity_days: form.validity_days,
          devis_expiry_date: expiryDate,
          devis_conditions: form.conditions || null,
          devis_notes: form.notes || null,
          issue_date: form.date,
          due_date: null,
          subtotal: totalHT,
          tax_rate: Math.round(avgTVA * 100) / 100,
          tax_amount: totalTVA,
          total: totalTTC,
          currency: "MAD",
          items,
        })
        .select("id, invoice_number, clients(email)")
        .single();

    let { data: row, error: err } = await insertDevis(invoiceNumber);

    if (err && isDuplicateInvoiceNumberError(err)) {
      invoiceNumber = await getNextInvoiceDocumentNumber(supabase, {
        prefix: "DEV",
        userId,
      });
      setForm((f) => ({ ...f, num: invoiceNumber }));
      const retry = await insertDevis(invoiceNumber);
      row = retry.data;
      err = retry.error;
    }

    setSaving(false);
    if (err) {
      setError(translateError(err));
    } else {
      const clientEmail = (row as any).clients?.email ?? null;
      if (devisStatus === "brouillon") {
        router.push("/invoices?mode=devis");
        router.refresh();
      } else {
        setCreated({ id: row.id, number: row.invoice_number, clientEmail });
      }
    }
  }

  async function sendWhatsApp(devisId: string) {
    setWaState("loading");
    try {
      const res = await fetch(`/api/invoices/${devisId}/pdf`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const { whatsappUrl } = await res.json();
      window.open(whatsappUrl, "_blank");
      setWaState("success");
      toast.success("WhatsApp ouvert avec le devis 📲");
      setTimeout(() => { router.push("/invoices?mode=devis"); router.refresh(); }, 1500);
    } catch (e: any) {
      setWaState("error");
      toast.error(translateError(e), { duration: 5000 });
      setTimeout(() => setWaState("idle"), 2500);
    }
  }

  async function sendEmail(devisId: string) {
    setEmailState("loading");
    try {
      const res = await fetch(`/api/invoices/${devisId}/send-email`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
      setEmailState("success");
      toast.success("Email envoyé avec succès 📧");
      setTimeout(() => { router.push("/invoices?mode=devis"); router.refresh(); }, 1500);
    } catch (e: any) {
      setEmailState("error");
      toast.error(translateError(e), { duration: 5000 });
      setTimeout(() => setEmailState("idle"), 2500);
    }
  }

  async function downloadPDF(devisId: string) {
    setPdfState("loading");
    try {
      const res = await fetch(`/api/invoices/${devisId}/pdf`);
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
      a.download = match ? match[1] : `${created?.number ?? "devis"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setPdfState("idle");
    } catch (e: any) {
      setPdfState("error");
      toast.error(translateError(e), { duration: 5000 });
      setTimeout(() => setPdfState("idle"), 2500);
    }
  }

  if (created) {
    return (
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-8 flex flex-col items-center text-center gap-4">
        <div className="text-4xl">🎉</div>
        <div>
          <p className="text-[15px] font-semibold text-[#1A1A2E]">Devis créé !</p>
          <p className="text-[12.5px] text-[#6B7280] mt-0.5">
            Devis <span className="font-medium text-[#1A1A2E]">{created.number}</span> enregistré avec succès.
          </p>
        </div>
        <p className="text-[12px] text-[#6B7280]">Envoyer maintenant au client ?</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full max-w-2xl">
          <button
            onClick={() => sendWhatsApp(created.id)}
            disabled={waState === "loading" || waState === "success"}
            className={`btn justify-center flex items-center gap-1.5 ${
              waState === "success" ? "bg-[#059669] text-white border-[#059669]"
              : waState === "error" ? "bg-[#DC2626] text-white border-[#DC2626]"
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
              emailState === "success" ? "bg-[#059669] text-white border-[#059669]"
              : emailState === "error" ? "bg-[#DC2626] text-white border-[#DC2626]"
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
            {pdfState === "idle" && <><Download size={13} /> Télécharger le devis</>}
          </button>
        </div>
        <button
          onClick={() => { router.push("/invoices?mode=devis"); router.refresh(); }}
          className="text-[11.5px] text-[#6B7280] hover:text-[#1A1A2E] underline"
        >
          Retour aux devis
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-[18px]">
      <div className="alert-blue">
        💡 Le devis ne génère aucune écriture comptable. Une fois accepté, vous pourrez le convertir en facture.
      </div>

      {/* Header fields */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="col-span-2 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.6px] pb-2 border-b border-[rgba(0,0,0,0.08)]">
          Informations du devis
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">N° Devis</label>
          <input className="input" value={form.num} onChange={(e) => setForm(f => ({ ...f, num: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Date d&apos;émission</label>
          <input type="date" className="input" value={form.date} onChange={(e) => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Client</label>
          <select className="input" value={form.client_id} onChange={(e) => setForm(f => ({ ...f, client_id: e.target.value }))}>
            <option value="">Sélectionner un client...</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">
            Validité (jours) — expire le{" "}
            <span className="text-[#C8924A] font-semibold">
              {new Date(expiryDate).toLocaleDateString("fr-MA")}
            </span>
          </label>
          <input
            type="number"
            min={1}
            max={365}
            className="input"
            value={form.validity_days}
            onChange={(e) => setForm(f => ({ ...f, validity_days: Math.max(1, parseInt(e.target.value) || 30) }))}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Objet du devis</label>
          <input
            className="input"
            placeholder="Ex : Développement site web, Prestation de conseil..."
            value={form.objet}
            onChange={(e) => setForm(f => ({ ...f, objet: e.target.value }))}
          />
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
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedCatalogItem(value);
                    if (value) addCatalogItem(value);
                  }}
                >
                  <option value="">Sélectionner un article ou une prestation...</option>
                  {catalogItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {Number(item.unit_price || 0).toLocaleString("fr-MA", { minimumFractionDigits: 2 })} MAD HT · TVA {Number(item.tva_rate || 0)}%
                    </option>
                  ))}
                </select>
              </label>
              <p className="pb-2 text-[11px] font-medium text-[#9A672E]">Ajout automatique après sélection.</p>
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
              <button type="button" onClick={() => lines.length > 1 && setLines(p => p.filter((_, j) => j !== i))}
                className="flex items-center justify-center w-7 h-7 rounded bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FCA5A5] transition-colors disabled:opacity-40"
                disabled={lines.length === 1}>
                <Trash2 size={12} />
              </button>
            </div>
            {(line.desc.trim() || Number(line.pu || 0) > 0) && (
              <button type="button" onClick={() => saveLineAsCatalogItem(line)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-[#9A672E] hover:text-[#C8924A]">
                <Save size={11} /> Enregistrer cette ligne comme article
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={() => setLines(p => [...p, emptyLine()])}
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

      {/* Conditions & Notes */}
      <div className="grid grid-cols-1 gap-3 mt-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Conditions du devis (optionnel)</label>
          <textarea
            rows={3}
            className="input resize-none"
            placeholder="Conditions générales, modalités de paiement, délais d'exécution..."
            value={form.conditions}
            onChange={(e) => setForm(f => ({ ...f, conditions: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-medium text-[#6B7280]">Notes internes (optionnel)</label>
          <textarea
            rows={2}
            className="input resize-none"
            placeholder="Notes visibles sur le devis..."
            value={form.notes}
            onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
          />
        </div>
      </div>

      {error && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] rounded-lg px-3 py-2 mt-3">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2 mt-4 flex-wrap">
        <button onClick={() => save("brouillon")} disabled={saving} className="btn border border-[#0D1526] bg-[#0D1526] text-white hover:bg-[#1A2540]">
          {saving ? "..." : "Enregistrer brouillon"}
        </button>
        <button onClick={() => save("envoyé")} disabled={saving} className="btn btn-gold">
          {saving ? "..." : "✓ Créer et envoyer"}
        </button>
      </div>
    </div>
  );
}

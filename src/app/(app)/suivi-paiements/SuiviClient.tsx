"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";
import { createClient } from "@/lib/supabase/client";
import {
  TrendingUp, TrendingDown, AlertCircle, X, Loader2,
  Send, Mail, ChevronDown, ChevronUp, CheckCircle,
  MoreHorizontal, Eye, Download,
} from "lucide-react";
import SortableTh, { compareValues, nextSort, type SortDirection } from "@/components/SortableTh";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ClientInvoice {
  id: string;
  invoice_number: string;
  invoice_type?: string;
  issue_date: string;
  due_date: string | null;
  total: number;
  montant_recu?: number;
  status: string;
  relance_count?: number;
  last_relance_at?: string | null;
  clients?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    whatsapp?: string | null;
  } | null;
}

interface SupplierItem {
  id: string;
  file_name: string | null;
  status: string;
  created_at: string;
  ocr_data: {
    vendor_name?: string | null;
    vendor?: string | null;
    amount?: number | null;
    date?: string | null;
    due_date?: string | null;
    receipt_number?: string | null;
    is_supplier_invoice?: boolean | null;
    document_type?: string | null;
    montant_paye?: number | null;
    payment_status?: string | null;
  };
}

type SubTab = "all" | "overdue" | "week" | "upcoming" | "paid";
type ClientPaymentSortKey = "number" | "client" | "issue" | "due" | "total" | "paid" | "balance" | "late" | "status";
type SupplierPaymentSortKey = "supplier" | "reference" | "received" | "due" | "total" | "paid" | "balance" | "late" | "status";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return d; }
}

function daysFromNow(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const due = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

function formatPhone(raw: string): string {
  const c = raw.replace(/[\s\-().+]/g, "");
  if (c.startsWith("00212")) return "+212" + c.slice(5);
  if (c.startsWith("212")) return "+" + c;
  if (c.startsWith("0")) return "+212" + c.slice(1);
  return "+" + c;
}

function supplierName(item: SupplierItem) {
  return item.ocr_data.vendor_name ?? item.ocr_data.vendor ?? item.file_name ?? "Fournisseur";
}

function supplierTotal(item: SupplierItem) {
  return Math.abs(Number(item.ocr_data.amount ?? 0));
}

function supplierPaid(item: SupplierItem) {
  return Number(item.ocr_data.montant_paye ?? 0);
}

function isSupplierPaid(item: SupplierItem) {
  return item.ocr_data.payment_status === "paid" || item.status === "paid";
}

// ── DaysCell ───────────────────────────────────────────────────────────────────

function DaysCell({ dueDate, isPaid }: { dueDate: string | null; isPaid: boolean }) {
  if (isPaid) return <span className="text-[#059669] font-medium text-[11.5px]">Payée</span>;
  const d = daysFromNow(dueDate);
  if (d === null) return <span className="text-[#9CA3AF] text-[11.5px]">—</span>;
  if (d > 7) return <span className="text-[#9CA3AF] text-[11.5px]">Dans {d}j</span>;
  if (d > 0) return <span className="text-[#D97706] font-semibold text-[11.5px]">Dans {d}j</span>;
  if (d === 0) return <span className="text-[#D97706] font-semibold text-[11.5px]">Aujourd&apos;hui</span>;
  return <span className="text-[#DC2626] font-bold text-[11.5px]">+{Math.abs(d)} jours</span>;
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status, dueDate }: { status: string; dueDate: string | null }) {
  if (status === "paid") return <span className="badge-pill bg-[#D1FAE5] text-[#065F46]">Payée</span>;
  if (status === "partiellement_payee") return <span className="badge-pill bg-[#FEF3C7] text-[#92400E]">🟠 Partiel</span>;
  const d = daysFromNow(dueDate);
  if (d !== null && d < 0) {
    return (
      <span className="badge-pill bg-[#FEE2E2] text-[#991B1B] flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#DC2626] animate-pulse flex-shrink-0" />
        En retard
      </span>
    );
  }
  if (d !== null && d <= 7) return <span className="badge-pill bg-[#FEF3C7] text-[#92400E]">Échéance proche</span>;
  return <span className="badge-pill bg-[#EFF6FF] text-[#1D4ED8]">🔵 En attente</span>;
}

// ── KPICard ────────────────────────────────────────────────────────────────────

function KPICard({
  label, value, sub, borderColor, icon, iconColor, pulse,
}: {
  label: string; value: string; sub: string;
  borderColor: string; icon: React.ReactNode; iconColor: string; pulse?: boolean;
}) {
  return (
    <div
      className="bg-white rounded-xl p-4 border border-[rgba(0,0,0,0.08)] flex-1 min-w-0"
      style={{ borderLeft: `3px solid ${borderColor}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] leading-tight">{label}</span>
        <span className={`flex-shrink-0 ${pulse ? "animate-pulse" : ""}`} style={{ color: iconColor }}>{icon}</span>
      </div>
      <div className="text-[18px] font-bold text-[#1A1A2E] leading-tight mb-1">{value}</div>
      <div className="text-[10.5px] text-[#9CA3AF]">{sub}</div>
    </div>
  );
}

// ── SubTabBar ──────────────────────────────────────────────────────────────────

function SubTabBar({
  tabs, active, onSelect, countFn,
}: {
  tabs: [SubTab, string][];
  active: SubTab;
  onSelect: (t: SubTab) => void;
  countFn: (t: SubTab) => number;
}) {
  return (
    <div className="flex gap-1 bg-[#F3F4F6] p-1 rounded-xl mb-4 w-fit flex-wrap">
      {tabs.map(([key, label]) => {
        const count = countFn(key);
        return (
          <button key={key} onClick={() => onSelect(key)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all select-none ${
              active === key ? "bg-white text-[#1A1A2E] shadow-sm" : "text-[#6B7280] hover:text-[#1A1A2E]"
            }`}>
            {label}
            {count > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                active === key ? "bg-[#F3F4F6] text-[#6B7280]" : "bg-white/60 text-[#9CA3AF]"
              }`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── ActionsMenu (client rows) ──────────────────────────────────────────────────

function ActionsMenu({ invoice, onMarkPaid, onRelance }: {
  invoice: ClientInvoice;
  onMarkPaid: () => void;
  onRelance: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  async function sendWhatsApp() {
    setOpen(false);
    const res = await fetch(`/api/invoices/${invoice.id}/pdf`, { method: "POST" });
    if (res.ok) {
      const { whatsappUrl } = await res.json();
      window.open(whatsappUrl, "_blank");
    }
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button onClick={() => setOpen(!open)}
        className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#6B7280] transition-colors">
        <MoreHorizontal size={13} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-[rgba(0,0,0,0.12)] rounded-xl shadow-xl z-20 min-w-[160px]">
          <a href={`/f/${invoice.id}`} target="_blank" rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[12px] text-[#374151] hover:bg-[#F9FAFB] transition-colors rounded-t-xl">
            <Eye size={12} /> Voir facture
          </a>
          <a href={`/api/invoices/${invoice.id}/pdf`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-[12px] text-[#374151] hover:bg-[#F9FAFB] transition-colors">
            <Download size={12} /> Télécharger PDF
          </a>
          <button onClick={sendWhatsApp}
            className="w-full flex items-center gap-2 px-3 py-2 text-[12px] text-[#374151] hover:bg-[#F9FAFB] transition-colors rounded-b-xl">
            <Send size={12} /> Envoyer WhatsApp
          </button>
        </div>
      )}
    </div>
  );
}

// ── PaidModal ──────────────────────────────────────────────────────────────────

function PaidModal({
  item, type, companyId, onClose, onSuccess,
}: {
  item: ClientInvoice | SupplierItem;
  type: "client" | "supplier";
  companyId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const inv = item as any;
  const isClient = type === "client";
  const total = isClient ? Number(inv.total) : supplierTotal(item as SupplierItem);
  const alreadyPaid = isClient ? Number(inv.montant_recu ?? 0) : supplierPaid(item as SupplierItem);
  const solde = Math.max(total - alreadyPaid, 0);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("Virement bancaire");
  const [reference, setReference] = useState("");
  const [montant, setMontant] = useState(solde.toFixed(2));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const montantNum = parseFloat(montant) || 0;
  const isPartial = montantNum > 0 && montantNum < solde - 0.01;
  const soldeRestant = solde - montantNum;

  async function submit() {
    if (!montantNum || montantNum <= 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/invoice-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: isClient ? item.id : undefined,
          inbox_item_id: !isClient ? item.id : undefined,
          company_id: companyId,
          montant: montantNum,
          date_paiement: date,
          mode_paiement: mode,
          reference: reference || null,
          notes: notes || null,
          payment_type: isClient ? "encaissement" : "decaissement",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Erreur");
      }
      toast.success("Paiement enregistré");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Erreur");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.08)]">
          <h3 className="text-[14px] font-bold text-[#1A1A2E]">
            {isClient ? "Confirmer l'encaissement" : "Confirmer le paiement fournisseur"}
          </h3>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF]">
            <X size={14} />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {/* Summary */}
          <div className="bg-[#F9FAFB] rounded-xl px-3 py-2.5 text-[12px]">
            <div className="font-semibold text-[#1A1A2E]">
              {isClient
                ? inv.invoice_number
                : supplierName(item as SupplierItem)}
            </div>
            <div className="text-[#6B7280] mt-0.5">
              Total : {fmt(total)}
              {alreadyPaid > 0 && <> · Déjà reçu : {fmt(alreadyPaid)} · Solde : {fmt(solde)}</>}
            </div>
          </div>
          {/* Date */}
          <div>
            <label className="field-label">Date de paiement</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          {/* Mode */}
          <div>
            <label className="field-label">Mode de paiement</label>
            <select className="input" value={mode} onChange={e => setMode(e.target.value)}>
              {["Virement bancaire", "Chèque", "Espèces", "Carte bancaire", "Prélèvement automatique"].map(m => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          {/* Reference */}
          <div>
            <label className="field-label">Référence / N° chèque (optionnel)</label>
            <input className="input" placeholder="REF-001" value={reference} onChange={e => setReference(e.target.value)} />
          </div>
          {/* Montant */}
          <div>
            <label className="field-label">Montant (MAD)</label>
            <input type="number" step="0.01" className="input font-semibold" value={montant} onChange={e => setMontant(e.target.value)} />
            {isPartial && soldeRestant > 0 && (
              <div className="mt-1.5 px-3 py-2 bg-[#FEF3C7] rounded-lg text-[11px] text-[#92400E]">
                Paiement partiel — solde restant : <strong>{fmt(soldeRestant)}</strong>
              </div>
            )}
          </div>
          {/* Notes */}
          <div>
            <label className="field-label">Notes (optionnel)</label>
            <textarea rows={2} className="input resize-none" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Remarques..." />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="btn btn-outline flex-1">Annuler</button>
          <button onClick={submit} disabled={saving || montantNum <= 0} className="btn btn-gold flex-1">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <><CheckCircle size={13} /> Confirmer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RelanceModal ───────────────────────────────────────────────────────────────

function RelanceModal({
  invoice, companyName, onClose, onSuccess,
}: {
  invoice: ClientInvoice;
  companyName: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const level = Math.min((invoice.relance_count ?? 0) + 1, 3);
  const [activeTab, setActiveTab] = useState<"whatsapp" | "email">("whatsapp");
  const [sending, setSending] = useState(false);

  const clientName = invoice.clients?.name ?? "Client";
  const num = invoice.invoice_number;
  const ttc = fmt(Number(invoice.total));
  const dueStr = invoice.due_date ? fmtDate(invoice.due_date) : "—";
  const company = companyName ?? "";

  const messages = [
    `Bonjour ${clientName},\n\nJ'espère que vous allez bien.\nJe me permets de vous rappeler que la facture *${num}* d'un montant de *${ttc}* est arrivée à échéance le *${dueStr}*.\n\nPourriez-vous nous indiquer la date de règlement prévue ?\n\nMerci d'avance,\n${company}`,
    `Bonjour ${clientName},\n\nSauf erreur de notre part, la facture *${num}* d'un montant de *${ttc}* reste impayée depuis le *${dueStr}*.\n\nNous vous remercions de bien vouloir régulariser cette situation dans les meilleurs délais.\n\n${company}`,
    `Bonjour ${clientName},\n\nMalgré nos relances précédentes, la facture *${num}* de *${ttc}* reste impayée.\n\nSans règlement sous 48h, nous serons contraints de prendre les mesures appropriées.\n\n${company}`,
  ];

  const levelLabels = ["1ère relance", "2ème relance", "3ème relance"];
  const levelColors = ["#059669", "#D97706", "#DC2626"];
  const message = messages[level - 1];

  const rawPhone = invoice.clients?.whatsapp || invoice.clients?.phone || null;
  const waUrl = rawPhone
    ? `https://wa.me/${formatPhone(rawPhone).replace("+", "")}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function trackRelance() {
    setSending(true);
    try {
      const supabase = createClient();
      await supabase.from("invoices").update({
        relance_count: (invoice.relance_count ?? 0) + 1,
        last_relance_at: new Date().toISOString(),
      }).eq("id", invoice.id);
      toast.success(`${levelLabels[level - 1]} envoyée`);
      onSuccess();
      onClose();
    } catch {
      toast.error("Erreur");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.08)]">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-bold text-[#1A1A2E]">Envoyer une relance</h3>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${levelColors[level - 1]}20`, color: levelColors[level - 1] }}>
              {levelLabels[level - 1]}
            </span>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#9CA3AF]">
            <X size={14} />
          </button>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3">
          {(["whatsapp", "email"] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                activeTab === t ? "bg-[#1A1A2E] text-white" : "text-[#6B7280] hover:bg-[#F3F4F6]"
              }`}>
              {t === "whatsapp" ? "📱 WhatsApp" : "📧 Email"}
            </button>
          ))}
        </div>
        {/* Message preview */}
        <div className="px-5 py-4">
          <div className="bg-[#F9F9F6] border border-[rgba(0,0,0,0.08)] rounded-xl p-3 max-h-52 overflow-y-auto">
            <pre className="text-[12px] text-[#374151] whitespace-pre-wrap font-sans leading-relaxed">{message}</pre>
          </div>
          {invoice.relance_count && invoice.relance_count > 0 ? (
            <p className="text-[10.5px] text-[#9CA3AF] mt-2">
              {invoice.relance_count} relance{invoice.relance_count > 1 ? "s" : ""} déjà envoyée{invoice.relance_count > 1 ? "s" : ""}
              {invoice.last_relance_at && ` · Dernière : ${fmtDate(invoice.last_relance_at.slice(0, 10))}`}
            </p>
          ) : null}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="btn btn-outline flex-1">Annuler</button>
          {activeTab === "whatsapp" ? (
            <a href={waUrl} target="_blank" rel="noopener noreferrer"
              onClick={() => { setTimeout(trackRelance, 300); }}
              className="btn btn-gold flex-1 text-center flex items-center justify-center gap-1.5 no-underline">
              <Send size={13} /> Ouvrir WhatsApp
            </a>
          ) : (
            <button onClick={trackRelance} disabled={sending} className="btn btn-gold flex-1">
              {sending ? <Loader2 size={13} className="animate-spin" /> : <><Mail size={13} /> Copier &amp; Envoyer</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── AgingTable ─────────────────────────────────────────────────────────────────

function AgingTable({ items, type }: { items: any[]; type: "client" | "supplier" }) {
  type Group = { name: string; courant: number; d30: number; d60: number; d90: number; d90plus: number };
  const groups: Record<string, Group> = {};

  for (const item of items) {
    let name: string;
    let solde: number;
    let days: number | null;

    if (type === "client") {
      if (item.status === "paid" || item.status === "draft") continue;
      name = item.clients?.name ?? "Client inconnu";
      solde = Number(item.total) - Number(item.montant_recu ?? 0);
      days = daysFromNow(item.due_date);
    } else {
      name = supplierName(item);
      if (isSupplierPaid(item)) continue;
      solde = supplierTotal(item) - supplierPaid(item);
      days = daysFromNow(item.ocr_data?.due_date ?? null);
    }

    if (solde <= 0.01) continue;
    if (!groups[name]) groups[name] = { name, courant: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
    const g = groups[name];
    if (days === null || days > 0) g.courant += solde;
    else if (days >= -30) g.d30 += solde;
    else if (days >= -60) g.d60 += solde;
    else if (days >= -90) g.d90 += solde;
    else g.d90plus += solde;
  }

  const rows = Object.values(groups);
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-[12px] text-[#9CA3AF]">
        Aucune créance à analyser
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, r) => ({ courant: acc.courant + r.courant, d30: acc.d30 + r.d30, d60: acc.d60 + r.d60, d90: acc.d90 + r.d90, d90plus: acc.d90plus + r.d90plus }),
    { courant: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 }
  );

  function ACell({ v, bg }: { v: number; bg?: string }) {
    if (v < 0.01) return <td className="px-3 py-2 text-right text-[#D1D5DB] text-[11.5px]">—</td>;
    return <td className="px-3 py-2 text-right text-[11.5px] font-medium rounded" style={{ background: bg }}>{fmt(v)}</td>;
  }

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div className="overflow-x-auto">
        <table className="w-full text-[11.5px] min-w-[700px]">
          <thead>
            <tr className="bg-[#F9F9F6] border-b border-[rgba(0,0,0,0.08)]">
              {[type === "client" ? "Client" : "Fournisseur", "Courant", "1–30j", "31–60j", "61–90j", "90j+", "Total"].map((h, i) => (
                <th key={h} className={`px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const total = row.courant + row.d30 + row.d60 + row.d90 + row.d90plus;
              return (
                <tr key={i} className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(200,146,74,0.03)]">
                  <td className="px-3 py-2 font-medium text-[#1A1A2E]">{row.name}</td>
                  <ACell v={row.courant} />
                  <ACell v={row.d30} bg={row.d30 > 0 ? "#FFFBEB" : undefined} />
                  <ACell v={row.d60} bg={row.d60 > 0 ? "#FEF3C7" : undefined} />
                  <ACell v={row.d90} bg={row.d90 > 0 ? "#FED7AA" : undefined} />
                  <ACell v={row.d90plus} bg={row.d90plus > 0 ? "#FEE2E2" : undefined} />
                  <td className="px-3 py-2 text-right font-bold text-[#1A1A2E]">{fmt(total)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[rgba(0,0,0,0.1)] bg-[#F9F9F6]">
              <td className="px-3 py-2 font-bold text-[11.5px] text-[#1A1A2E]">Total</td>
              {[totals.courant, totals.d30, totals.d60, totals.d90, totals.d90plus].map((v, i) => (
                <td key={i} className="px-3 py-2 text-right font-bold text-[11.5px] text-[#1A1A2E]">{fmt(v)}</td>
              ))}
              <td className="px-3 py-2 text-right font-bold text-[12px] text-[#C8924A]">
                {fmt(totals.courant + totals.d30 + totals.d60 + totals.d90 + totals.d90plus)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── Clients Section ────────────────────────────────────────────────────────────

const CLIENT_SUBTABS: [SubTab, string][] = [
  ["all", "Toutes"],
  ["overdue", "En retard"],
  ["week", "Cette semaine"],
  ["upcoming", "À venir"],
  ["paid", "Payées"],
];

function ClientsSection({
  invoices, filtered, subTab, setSubTab, countFn,
  onMarkPaid, onRelance, companyName,
  agingOpen, setAgingOpen,
}: {
  invoices: ClientInvoice[];
  filtered: ClientInvoice[];
  subTab: SubTab;
  setSubTab: (t: SubTab) => void;
  countFn: (t: SubTab) => number;
  onMarkPaid: (inv: ClientInvoice) => void;
  onRelance: (inv: ClientInvoice) => void;
  companyName: string | null;
  agingOpen: boolean;
  setAgingOpen: (v: boolean) => void;
}) {
  const [sortKey, setSortKey] = useState<ClientPaymentSortKey>("due");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function handleSort(nextKey: ClientPaymentSortKey) {
    const next = nextSort(sortKey, sortDirection, nextKey);
    setSortKey(next.key);
    setSortDirection(next.direction);
  }

  const sorted = useMemo(() => {
    const valueFor = (invoice: ClientInvoice, key: ClientPaymentSortKey): string | number | null => {
      const paid = Number(invoice.montant_recu ?? 0);
      const balance = Math.max(Number(invoice.total) - paid, 0);
      switch (key) {
        case "number": return invoice.invoice_number;
        case "client": return invoice.clients?.name ?? "";
        case "issue": return invoice.issue_date;
        case "due": return invoice.due_date ?? "";
        case "total": return Number(invoice.total ?? 0);
        case "paid": return paid;
        case "balance": return balance;
        case "late": return daysFromNow(invoice.due_date) ?? 99999;
        case "status": return invoice.status;
        default: return "";
      }
    };
    return [...filtered].sort((a, b) => compareValues(valueFor(a, sortKey), valueFor(b, sortKey), sortDirection));
  }, [filtered, sortKey, sortDirection]);

  return (
    <div>
      <SubTabBar tabs={CLIENT_SUBTABS} active={subTab} onSelect={setSubTab} countFn={countFn} />

      {filtered.length === 0 ? (
        <div className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-5 py-10 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <p className="text-[13px] font-medium text-[#6B7280]">Aucune facture dans cet onglet</p>
        </div>
      ) : (
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[900px]">
              <thead>
                <tr className="bg-[#F9F9F6] border-b border-[rgba(0,0,0,0.08)]">
                  <SortableTh sortKey="number" label="N° Facture" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="client" label="Client" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="issue" label="Émission" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="due" label="Échéance" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="total" label="TTC" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="paid" label="Reçu" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="balance" label="Solde" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="late" label="Retard" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="status" label="Statut" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <th className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((inv, idx) => {
                  const montantRecu = Number(inv.montant_recu ?? 0);
                  const solde = Number(inv.total) - montantRecu;
                  const isPaid = inv.status === "paid";
                  return (
                    <tr key={inv.id} className={`border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(200,146,74,0.03)] transition-colors ${idx % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}>
                      <td className="px-3 py-2.5 font-mono font-semibold text-[#C8924A] whitespace-nowrap text-[11px]">{inv.invoice_number}</td>
                      <td className="px-3 py-2.5 font-medium text-[#1A1A2E] max-w-[130px] truncate">{inv.clients?.name ?? "—"}</td>
                      <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{fmtDate(inv.issue_date)}</td>
                      <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{inv.due_date ? fmtDate(inv.due_date) : <span className="text-[#D1D5DB]">—</span>}</td>
                      <td className="px-3 py-2.5 font-semibold text-[#1A1A2E] whitespace-nowrap">{fmt(Number(inv.total))}</td>
                      <td className="px-3 py-2.5 text-[#059669] whitespace-nowrap">{montantRecu > 0 ? fmt(montantRecu) : <span className="text-[#D1D5DB]">—</span>}</td>
                      <td className="px-3 py-2.5 font-medium text-[#1A1A2E] whitespace-nowrap">{fmt(Math.max(solde, 0))}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap"><DaysCell dueDate={inv.due_date} isPaid={isPaid} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={inv.status} dueDate={inv.due_date} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {!isPaid && (
                            <button onClick={() => onMarkPaid(inv)}
                              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                              style={{ background: "#C8924A", color: "#fff", border: "none" }}>
                              <CheckCircle size={11} /> Payée
                            </button>
                          )}
                          {!isPaid && (
                            <button onClick={() => onRelance(inv)}
                              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[rgba(0,0,0,0.18)] text-[#374151] bg-[#FAFAF6] shadow-[0_1px_2px_rgba(13,21,38,0.05)] hover:bg-[#F0EDE5] transition-colors">
                              <Send size={10} /> Relancer
                            </button>
                          )}
                          <ActionsMenu invoice={inv} onMarkPaid={() => onMarkPaid(inv)} onRelance={() => onRelance(inv)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aging */}
      <button
        onClick={() => setAgingOpen(!agingOpen)}
        className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-[#6B7280] hover:text-[#1A1A2E] transition-colors"
      >
        {agingOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Analyse par ancienneté (vieillissement)
      </button>
      {agingOpen && (
        <div className="mt-2">
          <AgingTable items={invoices} type="client" />
        </div>
      )}
    </div>
  );
}

// ── Suppliers Section ──────────────────────────────────────────────────────────

const SUPPLIER_SUBTABS: [SubTab, string][] = [
  ["all", "Toutes"],
  ["overdue", "En retard"],
  ["week", "Cette semaine"],
  ["upcoming", "À venir"],
  ["paid", "Payées"],
];

function SuppliersSection({
  items, filtered, subTab, setSubTab, countFn,
  onMarkPaid, agingOpen, setAgingOpen,
}: {
  items: SupplierItem[];
  filtered: SupplierItem[];
  subTab: SubTab;
  setSubTab: (t: SubTab) => void;
  countFn: (t: SubTab) => number;
  onMarkPaid: (item: SupplierItem) => void;
  agingOpen: boolean;
  setAgingOpen: (v: boolean) => void;
}) {
  const [sortKey, setSortKey] = useState<SupplierPaymentSortKey>("due");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function handleSort(nextKey: SupplierPaymentSortKey) {
    const next = nextSort(sortKey, sortDirection, nextKey);
    setSortKey(next.key);
    setSortDirection(next.direction);
  }

  const sorted = useMemo(() => {
    const valueFor = (item: SupplierItem, key: SupplierPaymentSortKey): string | number | null => {
      const total = supplierTotal(item);
      const paid = supplierPaid(item);
      const balance = Math.max(total - paid, 0);
      const dueDate = item.ocr_data?.due_date ?? null;
      switch (key) {
        case "supplier": return supplierName(item);
        case "reference": return item.ocr_data?.receipt_number ?? "";
        case "received": return item.created_at?.slice(0, 10) ?? "";
        case "due": return dueDate ?? "";
        case "total": return total;
        case "paid": return paid;
        case "balance": return balance;
        case "late": return daysFromNow(dueDate) ?? 99999;
        case "status": return isSupplierPaid(item) ? "paid" : (dueDate && daysFromNow(dueDate) !== null && (daysFromNow(dueDate) ?? 1) < 0) ? "overdue" : "sent";
        default: return "";
      }
    };
    return [...filtered].sort((a, b) => compareValues(valueFor(a, sortKey), valueFor(b, sortKey), sortDirection));
  }, [filtered, sortKey, sortDirection]);

  return (
    <div>
      <SubTabBar tabs={SUPPLIER_SUBTABS} active={subTab} onSelect={setSubTab} countFn={countFn} />

      {filtered.length === 0 ? (
        <div className="bg-white border border-[rgba(0,0,0,0.07)] rounded-xl px-5 py-10 text-center" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
          <p className="text-[13px] font-medium text-[#6B7280]">Aucune facture fournisseur dans cet onglet</p>
          <p className="text-[11.5px] text-[#9CA3AF] mt-1">
            Les factures fournisseurs confirmées dans la Boîte de réception apparaissent ici.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[900px]">
              <thead>
                <tr className="bg-[#F9F9F6] border-b border-[rgba(0,0,0,0.08)]">
                  <SortableTh sortKey="supplier" label="Fournisseur" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="reference" label="Référence" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="received" label="Réception" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="due" label="Échéance" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="total" label="TTC" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="paid" label="Payé" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="balance" label="Solde" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="late" label="Retard" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <SortableTh sortKey="status" label="Statut" activeKey={sortKey} direction={sortDirection} onSort={handleSort} className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap" />
                  <th className="px-3 py-2.5 text-[10.5px] font-semibold text-[#6B7280] uppercase tracking-[0.4px] text-left whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item, idx) => {
                  const total = supplierTotal(item);
                  const paid = supplierPaid(item);
                  const solde = Math.max(total - paid, 0);
                  const isPaid = isSupplierPaid(item);
                  const dueDate = item.ocr_data?.due_date ?? null;
                  return (
                    <tr key={item.id} className={`border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(200,146,74,0.03)] transition-colors ${idx % 2 === 1 ? "bg-[#FAFAFA]" : ""}`}>
                      <td className="px-3 py-2.5 font-medium text-[#1A1A2E] max-w-[140px] truncate">{supplierName(item)}</td>
                      <td className="px-3 py-2.5 text-[#6B7280] font-mono text-[10.5px]">{item.ocr_data?.receipt_number ?? <span className="text-[#D1D5DB]">—</span>}</td>
                      <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{fmtDate(item.created_at?.slice(0, 10))}</td>
                      <td className="px-3 py-2.5 text-[#6B7280] whitespace-nowrap">{dueDate ? fmtDate(dueDate) : <span className="text-[#D1D5DB]">—</span>}</td>
                      <td className="px-3 py-2.5 font-semibold text-[#1A1A2E] whitespace-nowrap">{fmt(total)}</td>
                      <td className="px-3 py-2.5 text-[#059669] whitespace-nowrap">{paid > 0 ? fmt(paid) : <span className="text-[#D1D5DB]">—</span>}</td>
                      <td className="px-3 py-2.5 font-medium text-[#1A1A2E] whitespace-nowrap">{fmt(solde)}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap"><DaysCell dueDate={dueDate} isPaid={isPaid} /></td>
                      <td className="px-3 py-2.5"><StatusBadge status={isPaid ? "paid" : (dueDate && daysFromNow(dueDate) !== null && (daysFromNow(dueDate) ?? 1) < 0) ? "overdue" : "sent"} dueDate={dueDate} /></td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {!isPaid && (
                            <button onClick={() => onMarkPaid(item)}
                              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
                              style={{ background: "#1A1A2E", color: "#fff", border: "none" }}>
                              Payée
                            </button>
                          )}
                          <a href={`/inbox`}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border border-[rgba(0,0,0,0.18)] text-[#374151] bg-[#FAFAF6] shadow-[0_1px_2px_rgba(13,21,38,0.05)] hover:bg-[#F0EDE5] transition-colors">
                            <Eye size={10} /> Voir
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Aging */}
      <button
        onClick={() => setAgingOpen(!agingOpen)}
        className="mt-4 flex items-center gap-2 text-[12px] font-semibold text-[#6B7280] hover:text-[#1A1A2E] transition-colors"
      >
        {agingOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        Analyse par ancienneté (vieillissement)
      </button>
      {agingOpen && (
        <div className="mt-2">
          <AgingTable items={items} type="supplier" />
        </div>
      )}
    </div>
  );
}

// ── Main SuiviClient ───────────────────────────────────────────────────────────

interface SuiviClientProps {
  clientInvoices: ClientInvoice[];
  supplierItems: SupplierItem[];
  companyId: string | null;
  companyName?: string | null;
}

export default function SuiviClient({
  clientInvoices: initClients,
  supplierItems: initSuppliers,
  companyId,
  companyName = null,
}: SuiviClientProps) {
  const ownerId = useAccountOwnerId();
  const [clientInvoices, setClientInvoices] = useState(initClients);
  const [supplierItems, setSupplierItems] = useState(initSuppliers);
  const [mainTab, setMainTab] = useState<"clients" | "suppliers">("clients");
  const [clientSubTab, setClientSubTab] = useState<SubTab>("all");
  const [supplierSubTab, setSupplierSubTab] = useState<SubTab>("all");
  const [paidModal, setPaidModal] = useState<{ item: ClientInvoice | SupplierItem; type: "client" | "supplier" } | null>(null);
  const [relanceModal, setRelanceModal] = useState<ClientInvoice | null>(null);
  const [agingOpen, setAgingOpen] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const weekStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  async function reload() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [invRes, supRes] = await Promise.all([
      supabase.from("invoices").select("*, clients(id, name, email, phone, whatsapp)")
        .eq("user_id", ownerId).is("dossier_id", null).eq("invoice_type", "facture")
        .neq("status", "draft").neq("status", "cancelled")
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("receipts").select("*").eq("user_id", ownerId).is("dossier_id", null).eq("status", "matched"),
    ]);
    if (invRes.data) setClientInvoices(invRes.data as any);
    const filtered = (supRes.data ?? []).filter((r: any) =>
      r.ocr_data?.document_type !== "avoir" && r.ocr_data?.is_supplier_invoice !== false
    );
    setSupplierItems(filtered as any);
  }

  // ── KPI calculations ──────────────────────────────────────────────────────

  const unpaidClients = clientInvoices.filter(i => i.status !== "paid");
  const totalAEncaisser = unpaidClients.reduce((s, i) => s + Math.max(Number(i.total) - Number(i.montant_recu ?? 0), 0), 0);
  const overdueClients = unpaidClients.filter(i => i.due_date && i.due_date < todayStr);
  const totalEnRetardClients = overdueClients.reduce((s, i) => s + Math.max(Number(i.total) - Number(i.montant_recu ?? 0), 0), 0);

  const unpaidSuppliers = supplierItems.filter(i => !isSupplierPaid(i));
  const totalAPayer = unpaidSuppliers.reduce((s, i) => s + Math.max(supplierTotal(i) - supplierPaid(i), 0), 0);
  const overdueSuppliers = unpaidSuppliers.filter(i => {
    const dd = i.ocr_data?.due_date;
    return dd && dd < todayStr;
  });
  const totalEnRetardSuppliers = overdueSuppliers.reduce((s, i) => s + Math.max(supplierTotal(i) - supplierPaid(i), 0), 0);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filteredClients = useMemo(() => {
    switch (clientSubTab) {
      case "overdue": return clientInvoices.filter(i => i.status !== "paid" && i.due_date && i.due_date < todayStr);
      case "week": return clientInvoices.filter(i => i.status !== "paid" && i.due_date && i.due_date >= todayStr && i.due_date <= weekStr);
      case "upcoming": return clientInvoices.filter(i => i.status !== "paid" && (!i.due_date || i.due_date > weekStr));
      case "paid": return clientInvoices.filter(i => i.status === "paid");
      default: return clientInvoices;
    }
  }, [clientInvoices, clientSubTab, todayStr, weekStr]);

  const filteredSuppliers = useMemo(() => {
    switch (supplierSubTab) {
      case "overdue": return supplierItems.filter(i => !isSupplierPaid(i) && i.ocr_data?.due_date && i.ocr_data.due_date < todayStr);
      case "week": return supplierItems.filter(i => !isSupplierPaid(i) && i.ocr_data?.due_date && i.ocr_data.due_date >= todayStr && i.ocr_data.due_date <= weekStr);
      case "upcoming": return supplierItems.filter(i => !isSupplierPaid(i) && (!i.ocr_data?.due_date || i.ocr_data.due_date > weekStr));
      case "paid": return supplierItems.filter(i => isSupplierPaid(i));
      default: return supplierItems;
    }
  }, [supplierItems, supplierSubTab, todayStr, weekStr]);

  function clientCount(tab: SubTab) {
    switch (tab) {
      case "overdue": return clientInvoices.filter(i => i.status !== "paid" && i.due_date && i.due_date < todayStr).length;
      case "week": return clientInvoices.filter(i => i.status !== "paid" && i.due_date && i.due_date >= todayStr && i.due_date <= weekStr).length;
      case "upcoming": return clientInvoices.filter(i => i.status !== "paid" && (!i.due_date || i.due_date > weekStr)).length;
      case "paid": return clientInvoices.filter(i => i.status === "paid").length;
      default: return clientInvoices.length;
    }
  }

  function supplierCount(tab: SubTab) {
    switch (tab) {
      case "overdue": return supplierItems.filter(i => !isSupplierPaid(i) && i.ocr_data?.due_date && i.ocr_data.due_date < todayStr).length;
      case "week": return supplierItems.filter(i => !isSupplierPaid(i) && i.ocr_data?.due_date && i.ocr_data.due_date >= todayStr && i.ocr_data.due_date <= weekStr).length;
      case "upcoming": return supplierItems.filter(i => !isSupplierPaid(i) && (!i.ocr_data?.due_date || i.ocr_data.due_date > weekStr)).length;
      case "paid": return supplierItems.filter(i => isSupplierPaid(i)).length;
      default: return supplierItems.length;
    }
  }

  return (
    <div>
      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPICard
          label="À encaisser"
          value={fmt(totalAEncaisser)}
          sub={`${unpaidClients.length} facture${unpaidClients.length !== 1 ? "s" : ""} client${unpaidClients.length !== 1 ? "s" : ""}`}
          borderColor="#059669"
          icon={<TrendingUp size={16} />}
          iconColor="#059669"
        />
        <KPICard
          label="Clients en retard"
          value={fmt(totalEnRetardClients)}
          sub={`${overdueClients.length} facture${overdueClients.length !== 1 ? "s" : ""}`}
          borderColor="#DC2626"
          icon={<AlertCircle size={16} />}
          iconColor="#DC2626"
          pulse={overdueClients.length > 0}
        />
        <KPICard
          label="À payer fournisseurs"
          value={fmt(totalAPayer)}
          sub={`${unpaidSuppliers.length} facture${unpaidSuppliers.length !== 1 ? "s" : ""} fournisseur${unpaidSuppliers.length !== 1 ? "s" : ""}`}
          borderColor="#D97706"
          icon={<TrendingDown size={16} />}
          iconColor="#DC2626"
        />
        <KPICard
          label="Fournisseurs en retard"
          value={fmt(totalEnRetardSuppliers)}
          sub={`${overdueSuppliers.length} facture${overdueSuppliers.length !== 1 ? "s" : ""}`}
          borderColor="#DC2626"
          icon={<AlertCircle size={16} />}
          iconColor="#DC2626"
          pulse={overdueSuppliers.length > 0}
        />
      </div>

      {/* ── Main Tabs ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {([
          ["clients", "Clients — À encaisser", overdueClients.length] as const,
          ["suppliers", "Fournisseurs — À payer", overdueSuppliers.length] as const,
        ] as const).map(([key, label, badge]) => (
          <button key={key} onClick={() => setMainTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
              mainTab === key
                ? "bg-[#1A1A2E] text-white shadow-sm"
                : "bg-white text-[#6B7280] border border-[rgba(0,0,0,0.1)] hover:border-[#1A1A2E]"
            }`}>
            {label}
            {badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                mainTab === key ? "bg-[#DC2626] text-white" : "bg-[#FEE2E2] text-[#DC2626]"
              }`}>{badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Sections ───────────────────────────────────────────────────────── */}
      {mainTab === "clients" && (
        <ClientsSection
          invoices={clientInvoices}
          filtered={filteredClients}
          subTab={clientSubTab}
          setSubTab={setClientSubTab}
          countFn={clientCount}
          onMarkPaid={inv => setPaidModal({ item: inv, type: "client" })}
          onRelance={inv => setRelanceModal(inv)}
          companyName={companyName}
          agingOpen={agingOpen}
          setAgingOpen={setAgingOpen}
        />
      )}
      {mainTab === "suppliers" && (
        <SuppliersSection
          items={supplierItems}
          filtered={filteredSuppliers}
          subTab={supplierSubTab}
          setSubTab={setSupplierSubTab}
          countFn={supplierCount}
          onMarkPaid={item => setPaidModal({ item, type: "supplier" })}
          agingOpen={agingOpen}
          setAgingOpen={setAgingOpen}
        />
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {paidModal && (
        <PaidModal
          item={paidModal.item}
          type={paidModal.type}
          companyId={companyId}
          onClose={() => setPaidModal(null)}
          onSuccess={reload}
        />
      )}
      {relanceModal && (
        <RelanceModal
          invoice={relanceModal}
          companyName={companyName}
          onClose={() => setRelanceModal(null)}
          onSuccess={reload}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import toast from "react-hot-toast";
import { translateError } from "@/lib/errors";
import { Loader2, FileText, Plus, X, Search, ReceiptText, ClipboardList } from "lucide-react";
import type { Invoice, InvoiceStatus, PartialPayment, DevisStatus } from "@/types";

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-MA");
}

// ── Types ──────────────────────────────────────────────────────────────────────

type TabKey = "all" | InvoiceStatus | DevisStatus;

type InvoiceExt = Invoice & {
  montant_paye?: number;
  reste_a_payer?: number | null;
  paiements?: PartialPayment[];
};

// ── Constants ──────────────────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: "all",                label: "Toutes" },
  { key: "sent",               label: "En attente" },
  { key: "partiellement_payee", label: "Partiel" },
  { key: "paid",               label: "Payées" },
  { key: "overdue",            label: "En retard" },
  { key: "draft",              label: "Brouillons" },
];

const AVOIR_TABS: { key: TabKey; label: string }[] = [
  { key: "all",   label: "Tous" },
  { key: "draft", label: "Brouillons" },
  { key: "sent",  label: "Envoyés" },
];

const DEVIS_TABS: { key: TabKey; label: string }[] = [
  { key: "all",      label: "Tous" },
  { key: "brouillon", label: "Brouillons" },
  { key: "envoyé",   label: "Envoyés" },
  { key: "accepté",  label: "Acceptés" },
  { key: "refusé",   label: "Refusés" },
];

// Badge: [bg, textColor, label]
const BADGE: Record<string, [string, string, string]> = {
  paid:                 ["#D1FAE5", "#065F46",  "Payée"],
  sent:                 ["#EFF6FF", "#1D4ED8",  "En attente"],
  overdue:              ["#FEE2E2", "#991B1B",  "En retard"],
  draft:                ["#F3F4F6", "#6B7280",  "Brouillon"],
  cancelled:            ["#F3F4F6", "#6B7280",  "Annulée"],
  partiellement_payee:  ["#FEF3C7", "#92400E",  "Partiel"],
};

const AVOIR_BADGE: Record<string, [string, string, string]> = {
  draft: ["#F3F4F6", "#6B7280", "Brouillon"],
  sent:  ["#DCFCE7", "#166534", "Envoyé"],
};

const DEVIS_BADGE: Record<string, [string, string, string]> = {
  brouillon: ["#F3F4F6", "#6B7280",  "Brouillon"],
  envoyé:    ["#EFF6FF", "#1D4ED8",  "Envoyé"],
  accepté:   ["#D1FAE5", "#065F46",  "Accepté"],
  refusé:    ["#FEE2E2", "#991B1B",  "Refusé"],
  expiré:    ["#FEF3C7", "#92400E",  "Expiré"],
};

const MODES_PAIEMENT = ["Virement", "Chèque", "Espèces", "Carte bancaire"];

// ── Partial Payment Modal ──────────────────────────────────────────────────────

function PartialPaymentModal({ invoice, onClose, onSaved }: {
  invoice: InvoiceExt;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("Virement");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const totalTtc = Number(invoice.total);
  const montantPaye = Number(invoice.montant_paye ?? 0);
  const resteAPayer = Math.max(0, totalTtc - montantPaye);

  async function handleSave() {
    const montantSaisi = parseFloat(montant.replace(",", "."));
    if (isNaN(montantSaisi) || montantSaisi <= 0) { toast.error("Montant invalide"); return; }
    if (montantSaisi > resteAPayer + 0.01) { toast.error("Le montant dépasse le reste à payer"); return; }
    setSaving(true);

    const nouveauMontantPaye = montantPaye + montantSaisi;
    const nouveauReste = totalTtc - nouveauMontantPaye;
    const nouveauStatut =
      nouveauReste <= 0.01 ? "paid"
      : nouveauMontantPaye > 0 ? "partiellement_payee"
      : "sent";

    const newPaiements: PartialPayment[] = [
      ...(Array.isArray(invoice.paiements) ? invoice.paiements : []),
      { date, montant: montantSaisi, mode, ...(note ? { note } : {}) },
    ];

    const { error } = await supabase.from("invoices").update({
      montant_paye: nouveauMontantPaye,
      reste_a_payer: nouveauReste,
      status: nouveauStatut,
      paiements: newPaiements,
    }).eq("id", invoice.id);

    setSaving(false);
    if (error) {
      console.error("Partial payment error:", error);
      toast.error(error.message || translateError(error), { duration: 8000 });
      return;
    }
    toast.success("Paiement enregistré ✓");
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[420px] mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[16px] font-bold text-[#1A1A2E]">Enregistrer un paiement</h2>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#6B7280]">
            <X size={16} />
          </button>
        </div>

        {/* Invoice summary */}
        <div className="bg-[#F9FAFB] rounded-xl px-4 py-3 mb-4 flex flex-col gap-1.5">
          <div className="flex justify-between text-[12.5px]">
            <span className="text-[#6B7280]">Facture</span>
            <span className="font-semibold text-[#1A1A2E]">{invoice.invoice_number}</span>
          </div>
          <div className="flex justify-between text-[12.5px]">
            <span className="text-[#6B7280]">Total TTC</span>
            <span className="font-semibold text-[#1A1A2E]">{fmt(totalTtc)}</span>
          </div>
          {montantPaye > 0 && (
            <div className="flex justify-between text-[12.5px]">
              <span className="text-[#6B7280]">Déjà payé</span>
              <span className="font-semibold text-[#059669]">{fmt(montantPaye)}</span>
            </div>
          )}
          <div className="h-px bg-[rgba(0,0,0,0.06)] my-0.5" />
          <div className="flex justify-between text-[12.5px]">
            <span className="text-[#6B7280]">Reste à payer</span>
            <span className="font-bold text-[#C8924A]">{fmt(resteAPayer)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Amount */}
          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Montant du paiement *</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="0,00"
                className="flex-1 border border-[rgba(0,0,0,0.12)] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#C8924A] focus:ring-1 focus:ring-[rgba(200,146,74,0.3)]"
              />
              <span className="text-[12px] text-[#6B7280] flex-shrink-0">MAD</span>
            </div>
            <button
              type="button"
              onClick={() => setMontant(String(Math.round(resteAPayer * 100) / 100))}
              className="mt-1.5 text-[11px] text-[#C8924A] hover:underline"
            >
              Tout régler : {fmt(resteAPayer)}
            </button>
          </div>

          {/* Date */}
          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Date du paiement *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-[rgba(0,0,0,0.12)] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#C8924A] focus:ring-1 focus:ring-[rgba(200,146,74,0.3)]"
            />
          </div>

          {/* Mode */}
          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Mode de paiement</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full border border-[rgba(0,0,0,0.12)] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#C8924A] focus:ring-1 focus:ring-[rgba(200,146,74,0.3)] bg-white"
            >
              {MODES_PAIEMENT.map((m) => <option key={m}>{m}</option>)}
            </select>
          </div>

          {/* Note */}
          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">Note (optionnel)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Référence, commentaire..."
              className="w-full border border-[rgba(0,0,0,0.12)] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#C8924A] focus:ring-1 focus:ring-[rgba(200,146,74,0.3)]"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 btn btn-outline justify-center">Annuler</button>
          <button
            onClick={handleSave}
            disabled={saving || !montant}
            className="flex-1 btn btn-gold justify-center disabled:opacity-60 flex items-center gap-1.5"
          >
            {saving
              ? <><Loader2 size={13} className="animate-spin" /> Enregistrement...</>
              : "Enregistrer le paiement"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Invoice context menu ───────────────────────────────────────────────────────

type MenuItem = { label: string; href?: string; action?: () => void; red?: boolean };

function InvoiceMenu({ inv, onMarkPaid, onDelete, onAddPayment, basePath, isAvoir }: {
  inv: InvoiceExt;
  onMarkPaid: (id: string) => void;
  onDelete: (id: string) => void;
  onAddPayment: (inv: InvoiceExt) => void;
  basePath: string;
  isAvoir?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [waLoading, setWaLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current!.getBoundingClientRect();
    const DROPDOWN_H = 280;
    const DROPDOWN_W = 215;
    const spaceBelow = window.innerHeight - rect.bottom;
    setPos({
      top: spaceBelow < DROPDOWN_H ? rect.top - DROPDOWN_H : rect.bottom + 4,
      left: Math.max(8, rect.right - DROPDOWN_W),
    });
    setOpen(true);
  }

  async function handleEmail() {
    setOpen(false); setEmailLoading(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/send-email`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(json.message || json.error || "Erreur d'envoi email", { duration: 5000 });
      else toast.success("Email envoyé avec succès 📧");
    } catch { toast.error("Erreur d'envoi. Vérifiez votre connexion.", { duration: 5000 }); }
    finally { setEmailLoading(false); }
  }

  async function handleWhatsApp() {
    setOpen(false); setWaLoading(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/pdf`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const { whatsappUrl } = await res.json();
      window.open(whatsappUrl, "_blank");
      toast.success("WhatsApp ouvert 📲");
    } catch (err: any) { toast.error(translateError(err), { duration: 5000 }); }
    finally { setWaLoading(false); }
  }

  async function handlePdf() {
    setOpen(false);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/pdf`);
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const match = (res.headers.get("content-disposition") ?? "").match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match ? match[1] : `facture-${inv.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
    } catch (e: any) { toast.error(translateError(e)); }
  }

  function handleRelance() {
    setOpen(false);
    const phone = (inv as any).clients?.phone?.replace(/\D/g, "");
    if (!phone) { toast.error("Numéro de téléphone du client manquant"); return; }
    const msg = encodeURIComponent(`Bonjour, je vous relance concernant la facture ${inv.invoice_number} d'un montant de ${fmt(Number(inv.total))}. Merci de procéder au règlement.`);
    window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
  }

  const addPmt: MenuItem = {
    label: "Ajouter un paiement partiel",
    action: () => { setOpen(false); onAddPayment(inv); },
  };

  const createAvoir: MenuItem = {
    label: "Créer un avoir",
    href: `${basePath}/avoir/new?linked=${inv.id}`,
  };

  const itemsByStatus: Record<string, MenuItem[]> = {
    draft: [
      { label: "Modifier", href: `${basePath}/${inv.id}/edit` },
      { label: "Télécharger PDF", action: handlePdf },
      { label: "Envoyer par WhatsApp", action: handleWhatsApp },
      { label: "Envoyer par email", action: handleEmail },
      { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
    ],
    sent: [
      { label: "Voir la facture", href: `${basePath}/${inv.id}` },
      { label: "Télécharger PDF", action: handlePdf },
      { label: "Envoyer par WhatsApp", action: handleWhatsApp },
      { label: "Envoyer par email", action: handleEmail },
      addPmt,
      { label: "Marquer comme payée", action: () => { setOpen(false); onMarkPaid(inv.id); } },
      createAvoir,
      { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
    ],
    partiellement_payee: [
      { label: "Voir la facture", href: `${basePath}/${inv.id}` },
      { label: "Télécharger PDF", action: handlePdf },
      { label: "Envoyer par WhatsApp", action: handleWhatsApp },
      { label: "Envoyer par email", action: handleEmail },
      addPmt,
      { label: "Marquer comme payée", action: () => { setOpen(false); onMarkPaid(inv.id); } },
      createAvoir,
      { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
    ],
    paid: [
      { label: "Voir la facture", href: `${basePath}/${inv.id}` },
      { label: "Télécharger PDF", action: handlePdf },
      { label: "Envoyer par WhatsApp", action: handleWhatsApp },
      { label: "Envoyer par email", action: handleEmail },
      createAvoir,
      { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
    ],
    overdue: [
      { label: "Voir la facture", href: `${basePath}/${inv.id}` },
      { label: "Télécharger PDF", action: handlePdf },
      { label: "Envoyer par WhatsApp", action: handleWhatsApp },
      { label: "Envoyer par email", action: handleEmail },
      addPmt,
      { label: "Marquer comme payée", action: () => { setOpen(false); onMarkPaid(inv.id); } },
      { label: "Relancer le client", action: handleRelance },
      createAvoir,
      { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
    ],
    cancelled: [
      { label: "Voir la facture", href: `${basePath}/${inv.id}` },
      { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
    ],
  };

  const AVOIR_EXCLUDED = ["Ajouter un paiement partiel", "Marquer comme payée", "Créer un avoir"];
  const items = (itemsByStatus[inv.status as string] ?? itemsByStatus.sent)
    .filter((item) => !isAvoir || !AVOIR_EXCLUDED.includes(item.label));

  return (
    <>
      <div className="flex justify-end">
        <button
          ref={btnRef}
          onClick={toggle}
          disabled={waLoading || emailLoading}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A2E] transition-colors text-[18px] leading-none"
        >
          {(waLoading || emailLoading) ? <Loader2 size={13} className="animate-spin" /> : "⋯"}
        </button>
      </div>

      {open && (
        <div
          ref={menuRef}
          className="py-1"
          style={{
            position: "fixed",
            top: pos.top,
            left: pos.left,
            zIndex: 9999,
            minWidth: "215px",
            background: "white",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {items.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-[13px] text-[#1A1A2E] hover:bg-[#FAFAF6] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full text-left px-4 py-2 text-[13px] hover:bg-[#FAFAF6] transition-colors"
                style={{ color: item.red ? "#DC2626" : "#1A1A2E" }}
              >
                {item.label}
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}

// ── Devis context menu ─────────────────────────────────────────────────────────

function DevisMenu({ inv, onDelete, onAccept, onRefuse, onConvert }: {
  inv: InvoiceExt;
  onDelete: (id: string) => void;
  onAccept: (id: string) => void;
  onRefuse: (id: string) => void;
  onConvert: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [waLoading, setWaLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current!.getBoundingClientRect();
    const DROPDOWN_H = 260;
    const DROPDOWN_W = 215;
    const spaceBelow = window.innerHeight - rect.bottom;
    setPos({
      top: spaceBelow < DROPDOWN_H ? rect.top - DROPDOWN_H : rect.bottom + 4,
      left: Math.max(8, rect.right - DROPDOWN_W),
    });
    setOpen(true);
  }

  async function handleWhatsApp() {
    setOpen(false); setWaLoading(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/pdf`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const { whatsappUrl } = await res.json();
      window.open(whatsappUrl, "_blank");
      toast.success("WhatsApp ouvert 📲");
    } catch (err: any) { toast.error(translateError(err), { duration: 5000 }); }
    finally { setWaLoading(false); }
  }

  async function handleEmail() {
    setOpen(false); setEmailLoading(true);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/send-email`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) toast.error(json.message || json.error || "Erreur d'envoi email", { duration: 5000 });
      else toast.success("Email envoyé avec succès 📧");
    } catch { toast.error("Erreur d'envoi. Vérifiez votre connexion.", { duration: 5000 }); }
    finally { setEmailLoading(false); }
  }

  async function handlePdf() {
    setOpen(false);
    try {
      const res = await fetch(`/api/invoices/${inv.id}/pdf`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const match = (res.headers.get("content-disposition") ?? "").match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match ? match[1] : `devis-${inv.invoice_number}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
    } catch (e: any) { toast.error(translateError(e)); }
  }

  const devisStatus = (inv as any).devis_status as string;

  type DItem = { label: string; action: () => void; red?: boolean; green?: boolean };
  const items: DItem[] = [
    { label: "Modifier", action: () => { setOpen(false); window.location.href = `/invoices/${inv.id}/edit`; } },
    { label: "Télécharger PDF", action: handlePdf },
    { label: "Envoyer par WhatsApp", action: handleWhatsApp },
    { label: "Envoyer par email", action: handleEmail },
    ...(devisStatus !== "accepté" && devisStatus !== "refusé" ? [
      { label: "Marquer comme accepté", action: () => { setOpen(false); onAccept(inv.id); }, green: true },
      { label: "Marquer comme refusé", action: () => { setOpen(false); onRefuse(inv.id); }, red: true },
    ] : []),
    ...(devisStatus === "accepté" ? [
      { label: "Convertir en facture", action: () => { setOpen(false); onConvert(inv.id); }, green: true },
    ] : []),
    { label: "Supprimer", action: () => { setOpen(false); onDelete(inv.id); }, red: true },
  ];

  return (
    <>
      <div className="flex justify-end">
        <button
          ref={btnRef}
          onClick={toggle}
          disabled={waLoading || emailLoading}
          className="flex items-center justify-center w-7 h-7 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A2E] transition-colors text-[18px] leading-none"
        >
          {(waLoading || emailLoading) ? <Loader2 size={13} className="animate-spin" /> : "⋯"}
        </button>
      </div>
      {open && (
        <div
          ref={menuRef}
          className="py-1"
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, minWidth: "215px", background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={item.action}
              className="w-full text-left px-4 py-2 text-[13px] hover:bg-[#FAFAF6] transition-colors"
              style={{ color: item.red ? "#DC2626" : item.green ? "#059669" : "#1A1A2E" }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

type PageMode = "factures" | "avoirs" | "devis";

export default function InvoicesPage({ dossierId: propDossierId }: { dossierId?: string } = {}) {
  const searchParams = useSearchParams();
  const dossierId = propDossierId ?? searchParams.get("dossier_id");
  const basePath = dossierId ? `/comptable-pro/dossiers/${dossierId}/invoices` : "/invoices";
  const [invoices, setInvoices] = useState<InvoiceExt[]>([]);
  const [mode, setMode] = useState<PageMode>((searchParams.get("mode") as PageMode) ?? "factures");
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [paymentModal, setPaymentModal] = useState<InvoiceExt | null>(null);
  const supabase = createClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    const query = supabase.from("invoices").select("*, clients(id, name, email, phone)");
    const { data } = await (dossierId
      ? query.eq("dossier_id", dossierId)
      : query.eq("user_id", user!.id).is("dossier_id", null))
      .order("created_at", { ascending: false });
    setInvoices((data ?? []) as InvoiceExt[]);
    setLoading(false);
  }

  async function acceptDevis(id: string) {
    const { error } = await supabase.from("invoices").update({
      devis_status: "accepté",
      devis_accepted_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error("Erreur lors de la mise à jour"); return; }
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, devis_status: "accepté" } as any : i));
    toast.success("Devis marqué comme accepté ✓");
  }

  async function refuseDevis(id: string) {
    const reason = prompt("Motif du refus (optionnel) :");
    const { error } = await supabase.from("invoices").update({
      devis_status: "refusé",
      devis_refused_at: new Date().toISOString(),
      ...(reason ? { devis_refused_reason: reason } : {}),
    }).eq("id", id);
    if (error) { toast.error("Erreur lors de la mise à jour"); return; }
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, devis_status: "refusé" } as any : i));
    toast.success("Devis marqué comme refusé");
  }

  async function convertDevis(id: string) {
    if (!confirm("Convertir ce devis en facture ? Une nouvelle facture sera créée.")) return;
    try {
      const res = await fetch(`/api/devis/${id}/convert`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { toast.error(json.error || "Erreur lors de la conversion"); return; }
      toast.success(`Facture ${json.invoice_number} créée ✓`);
      load();
    } catch { toast.error("Erreur lors de la conversion"); }
  }

  useEffect(() => { load(); }, []);

  async function markPaid(id: string) {
    const inv = invoices.find((i) => i.id === id);
    const total = Number(inv?.total ?? 0);
    const { error } = await supabase.from("invoices").update({
      status: "paid",
      montant_paye: total,
      reste_a_payer: 0,
    }).eq("id", id);
    if (error) { toast.error("Erreur lors de la mise à jour"); return; }
    setInvoices((prev) => prev.map((i) => i.id === id
      ? { ...i, status: "paid" as InvoiceStatus, montant_paye: total, reste_a_payer: 0 }
      : i));
    toast.success("Facture marquée comme payée");
  }

  async function deleteInvoice(id: string) {
    if (!confirm("Supprimer cette facture ?")) return;
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) { toast.error("Erreur lors de la suppression"); return; }
    setInvoices((prev) => prev.filter((i) => i.id !== id));
    toast.success("Facture supprimée");
  }

  const factures = invoices.filter(
    (i) => !(i as any).invoice_type || (i as any).invoice_type === "facture"
  );
  const avoirs = invoices.filter(
    (i) => (i as any).invoice_type === "avoir_client"
  );
  const devis = invoices.filter(
    (i) => (i as any).invoice_type === "devis"
  );

  const modeInvoices = mode === "avoirs" ? avoirs : mode === "devis" ? devis : factures;

  const activeTabs = mode === "avoirs" ? AVOIR_TABS : mode === "devis" ? DEVIS_TABS : TABS;

  const tabCounts = activeTabs.reduce((acc, t) => {
    acc[t.key] = t.key === "all"
      ? modeInvoices.length
      : mode === "devis"
        ? modeInvoices.filter((i) => (i as any).devis_status === t.key).length
        : modeInvoices.filter((i) => i.status === t.key).length;
    return acc;
  }, {} as Record<TabKey, number>);

  const filtered = modeInvoices
    .filter((i) => {
      if (tab === "all") return true;
      if (mode === "devis") return (i as any).devis_status === tab;
      return i.status === tab;
    })
    .filter((i) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        i.invoice_number.toLowerCase().includes(q) ||
        ((i as any).clients?.name ?? "").toLowerCase().includes(q) ||
        (mode === "devis" && ((i as any).devis_objet ?? "").toLowerCase().includes(q))
      );
    })
    .filter((i) => {
      if (dateFrom && i.issue_date < dateFrom) return false;
      if (dateTo && i.issue_date > dateTo) return false;
      return true;
    });

  const hasFilters = search || dateFrom || dateTo;

  return (
    <div>
      {/* ─── Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: mode === "avoirs" ? "rgba(220,38,38,0.10)" : mode === "devis" ? "rgba(37,99,235,0.10)" : "rgba(200,146,74,0.12)" }}>
            {mode === "avoirs"
              ? <ReceiptText size={18} className="text-[#DC2626]" />
              : mode === "devis"
              ? <ClipboardList size={18} className="text-[#2563EB]" />
              : <FileText size={18} className="text-[#C8924A]" />
            }
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">
              {mode === "avoirs" ? "Avoirs clients" : mode === "devis" ? "Devis" : "Factures"}
            </h1>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
              {mode === "avoirs" ? "Avoirs et notes de crédit émis" : mode === "devis" ? "Propositions commerciales envoyées aux clients" : "Gérez et suivez vos factures clients"}
            </p>
          </div>
        </div>
        {mode === "avoirs" ? (
          <Link href={`${basePath}/avoir/new`}
            className="btn flex items-center gap-1.5"
            style={{ background: "#DC2626", color: "white", borderColor: "#DC2626" }}>
            <Plus size={13} /> Nouvel Avoir
          </Link>
        ) : mode === "devis" ? (
          <Link href="/invoices/devis/new"
            className="btn flex items-center gap-1.5"
            style={{ background: "#2563EB", color: "white", borderColor: "#2563EB" }}>
            <Plus size={13} /> Nouveau Devis
          </Link>
        ) : (
          <Link href={`${basePath}/new`} className="btn btn-gold flex items-center gap-1.5">
            <Plus size={13} /> Nouvelle Facture
          </Link>
        )}
      </div>

      {/* ─── Mode switcher ────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#F3F4F6] p-1 rounded-xl mb-4 w-fit">
        {([
          { key: "factures", label: "Factures",       count: factures.length },
          { key: "devis",    label: "Devis",           count: devis.length },
          { key: "avoirs",   label: "Avoirs clients",  count: avoirs.length },
        ] as { key: PageMode; label: string; count: number }[]).map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => { setMode(key); setTab("all"); setSearch(""); setDateFrom(""); setDateTo(""); }}
            className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-all select-none flex items-center gap-1.5 ${
              mode === key ? "bg-white text-[#1A1A2E] shadow-sm" : "text-[#6B7280] hover:text-[#1A1A2E]"
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                mode === key ? "bg-[#F3F4F6] text-[#6B7280]" : "bg-white/60 text-[#9CA3AF]"
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Pill tabs ────────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-[#F3F4F6] p-1 rounded-xl mb-4 w-fit flex-wrap">
        {activeTabs.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3.5 py-1.5 rounded-lg text-[12.5px] font-medium transition-all select-none ${
              tab === key ? "bg-white text-[#1A1A2E] shadow-sm" : "text-[#6B7280] hover:text-[#1A1A2E]"
            }`}>
            {label}
            {key !== "all" && tabCounts[key] > 0 && (
              <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab === key ? "bg-[#F3F4F6] text-[#6B7280]" : "bg-white/60 text-[#9CA3AF]"
              }`}>{tabCounts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Client ou N° facture..."
            className="pl-8 pr-8 py-2 border border-[rgba(0,0,0,0.10)] rounded-lg text-[12.5px] bg-white focus:outline-none focus:border-[#C8924A] w-[220px]"
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280]">
              <X size={12} />
            </button>
          )}
        </div>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          title="À partir du"
          className="px-3 py-2 border border-[rgba(0,0,0,0.10)] rounded-lg text-[12.5px] bg-white focus:outline-none focus:border-[#C8924A]"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          title="Jusqu'au"
          className="px-3 py-2 border border-[rgba(0,0,0,0.10)] rounded-lg text-[12.5px] bg-white focus:outline-none focus:border-[#C8924A]"
        />
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); }}
            className="px-3 py-2 rounded-lg text-[12px] text-[#6B7280] hover:text-[#1A1A2E] border border-[rgba(0,0,0,0.10)] bg-white flex items-center gap-1.5"
          >
            <X size={12} /> Effacer
          </button>
        )}
      </div>

      {/* ─── Table ────────────────────────────────────────────────────────── */}
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>{mode === "avoirs" ? "N° Avoir" : mode === "devis" ? "N° Devis" : "N° Facture"}</th>
              <th>Client</th>
              {mode === "devis" ? <th>Objet</th> : <><th>HT</th><th>TVA</th></>}
              <th>{mode === "avoirs" ? "Montant crédité" : mode === "devis" ? "Total HT" : "TTC / Paiement"}</th>
              {mode === "devis" && <th>TTC</th>}
              <th>Date</th>
              {mode === "avoirs" ? <th>Motif</th> : mode === "devis" ? <th>Expiration</th> : <th>Échéance</th>}
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-[#6B7280] text-[12px]">
                  Chargement...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-10">
                  <p className="text-[#6B7280] text-[12.5px] mb-3">
                    {mode === "avoirs" ? "Aucun avoir client" : mode === "devis" ? "Aucun devis" : "Aucune facture"}
                  </p>
                  {mode === "avoirs" ? (
                    <Link href={`${basePath}/avoir/new`} className="btn" style={{ background: "#DC2626", color: "white", borderColor: "#DC2626" }}>
                      + Nouvel Avoir
                    </Link>
                  ) : mode === "devis" ? (
                    <Link href="/invoices/devis/new" className="btn" style={{ background: "#2563EB", color: "white", borderColor: "#2563EB" }}>
                      + Nouveau Devis
                    </Link>
                  ) : (
                    <Link href={`${basePath}/new`} className="btn btn-gold">+ Nouvelle Facture</Link>
                  )}
                </td>
              </tr>
            )}
            {filtered.map((inv) => {
              const totalTtc = Number(inv.total);

              if (mode === "devis") {
                const ds = (inv as any).devis_status as string ?? "brouillon";
                const [bg, color, label] = DEVIS_BADGE[ds] ?? ["#F3F4F6", "#6B7280", ds];
                const expiryDate = (inv as any).devis_expiry_date as string | null;
                const today = new Date().toISOString().slice(0, 10);
                const isExpired = expiryDate && expiryDate < today && ds !== "accepté" && ds !== "refusé";
                return (
                  <tr key={inv.id}>
                    <td>
                      <span className="font-medium text-[#6B7280]">{inv.invoice_number}</span>
                    </td>
                    <td>{(inv as any).clients?.name ?? "—"}</td>
                    <td className="text-[#6B7280] text-[11.5px] max-w-[120px] truncate">
                      {(inv as any).devis_objet ?? "—"}
                    </td>
                    <td className="text-[#6B7280]">{fmt(Number(inv.subtotal))}</td>
                    <td className="font-semibold">{fmt(totalTtc)}</td>
                    <td className="text-[#6B7280]">{fmtDate(inv.issue_date)}</td>
                    <td className={isExpired ? "text-[#DC2626]" : "text-[#6B7280]"}>
                      {expiryDate ? fmtDate(expiryDate) : "—"}
                    </td>
                    <td>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{ backgroundColor: bg, color }}>
                        {label}
                      </span>
                    </td>
                    <td>
                      <DevisMenu
                        inv={inv}
                        onDelete={deleteInvoice}
                        onAccept={acceptDevis}
                        onRefuse={refuseDevis}
                        onConvert={convertDevis}
                      />
                    </td>
                  </tr>
                );
              }

              const status = inv.status as string;
              const badgeMap = mode === "avoirs" ? AVOIR_BADGE : BADGE;
              const [bg, color, label] = badgeMap[status] ?? ["#F3F4F6", "#6B7280", status];
              const isPartial = status === "partiellement_payee";
              const montantPaye = Number(inv.montant_paye ?? 0);
              const pct = totalTtc > 0 ? Math.min(100, (montantPaye / totalTtc) * 100) : 0;

              return (
                <tr key={inv.id}>
                  <td>
                    <Link href={`${basePath}/${inv.id}`}
                      className={`font-medium text-[#6B7280] transition-colors ${mode === "avoirs" ? "hover:text-[#DC2626]" : "hover:text-[#C8924A]"}`}>
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td>{(inv as any).clients?.name ?? "—"}</td>
                  <td className={mode === "avoirs" ? "text-[#DC2626]" : "text-[#6B7280]"}>
                    {mode === "avoirs" ? "- " : ""}{fmt(Number(inv.subtotal))}
                  </td>
                  <td className={mode === "avoirs" ? "text-[#DC2626]" : "text-[#6B7280]"}>
                    {mode === "avoirs" ? "- " : ""}{fmt(Number(inv.tax_amount))}
                  </td>
                  <td>
                    {mode === "avoirs" ? (
                      <span className="font-semibold text-[#DC2626]">- {fmt(totalTtc)}</span>
                    ) : isPartial ? (
                      <div>
                        <div className="text-[12.5px] font-semibold text-[#1A1A2E] whitespace-nowrap">
                          {montantPaye.toLocaleString("fr-MA", { minimumFractionDigits: 2 })}
                          <span className="text-[#9CA3AF] font-normal mx-1">/</span>
                          {fmt(totalTtc)}
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden mt-1"
                          style={{ backgroundColor: "#F3F4F6", maxWidth: "110px" }}>
                          <div className="h-full rounded-full"
                            style={{ backgroundColor: "#C8924A", width: `${pct}%` }} />
                        </div>
                      </div>
                    ) : (
                      <span className="font-semibold">{fmt(totalTtc)}</span>
                    )}
                  </td>
                  <td className="text-[#6B7280]">{fmtDate(inv.issue_date)}</td>
                  {mode === "avoirs" ? (
                    <td className="text-[#6B7280] text-[11.5px]">
                      {(inv as any).avoir_reason ?? "—"}
                    </td>
                  ) : (
                    <td className={status === "overdue" ? "text-[#DC2626]" : "text-[#6B7280]"}>
                      {inv.due_date ? fmtDate(inv.due_date) : "—"}
                    </td>
                  )}
                  <td>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: bg, color }}>
                      {label}
                    </span>
                  </td>
                  <td>
                    <InvoiceMenu
                      inv={inv}
                      onMarkPaid={markPaid}
                      onDelete={deleteInvoice}
                      onAddPayment={setPaymentModal}
                      basePath={basePath}
                      isAvoir={mode === "avoirs"}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ─── Partial payment modal ────────────────────────────────────────── */}
      {paymentModal && (
        <PartialPaymentModal
          invoice={paymentModal}
          onClose={() => setPaymentModal(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}

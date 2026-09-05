"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { translateError } from "@/lib/errors";
import { AlertTriangle, Check, CheckCircle2, Download, Loader2, Mail, Pencil, Send, Upload, X, XCircle } from "lucide-react";
import type { PartialPayment } from "@/types";

type WaState = "idle" | "loading" | "success" | "error";

interface Props {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  totalTtc: number;
  montantPaye: number;
  paiements?: PartialPayment[];
  clientPhone?: string | null;
  clientEmail?: string | null;
  clientId?: string | null;
  whatsappSentAt?: string | null;
  whatsappSentCount?: number;
  emailSentAt?: string | null;
  emailSentCount?: number;
}

// ── Partial Payment Modal ──────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " MAD";
}

const MODES_PAIEMENT = ["Virement", "Chèque", "Espèces", "Carte bancaire"];

function PartialPaymentModal({ invoiceId, invoiceNumber, totalTtc, montantPaye, paiements, onClose, onSaved }: {
  invoiceId: string;
  invoiceNumber: string;
  totalTtc: number;
  montantPaye: number;
  paiements: PartialPayment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [montant, setMontant] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("Virement");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

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
      ...paiements,
      { date, montant: montantSaisi, mode, ...(note ? { note } : {}) },
    ];

    const { error } = await supabase.from("invoices").update({
      montant_paye: nouveauMontantPaye,
      reste_a_payer: nouveauReste,
      status: nouveauStatut,
      paiements: newPaiements,
    }).eq("id", invoiceId);

    setSaving(false);
    if (error) {
      console.error("Partial payment error:", error);
      toast.error(error.message || translateError(error), { duration: 8000 });
      return;
    }
    toast.success("Paiement enregistré");
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
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] text-[#6B7280]">
            <X size={16} />
          </button>
        </div>

        {/* Invoice summary */}
        <div className="bg-[#F9FAFB] rounded-xl px-4 py-3 mb-4 flex flex-col gap-1.5">
          <div className="flex justify-between text-[12.5px]">
            <span className="text-[#6B7280]">Facture</span>
            <span className="font-semibold text-[#1A1A2E]">{invoiceNumber}</span>
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
            <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
              Montant du paiement *
            </label>
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
            <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
              Date du paiement *
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-[rgba(0,0,0,0.12)] rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:border-[#C8924A] focus:ring-1 focus:ring-[rgba(200,146,74,0.3)]"
            />
          </div>

          {/* Mode */}
          <div>
            <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
              Mode de paiement
            </label>
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
            <label className="block text-[12px] font-semibold text-[#374151] mb-1.5">
              Note (optionnel)
            </label>
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
          <button onClick={onClose} className="flex-1 btn btn-outline justify-center">
            Annuler
          </button>
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

// ── Main component ─────────────────────────────────────────────────────────────

export default function InvoiceActions({
  invoiceId,
  invoiceNumber,
  status,
  totalTtc,
  montantPaye,
  paiements = [],
  clientPhone,
  clientEmail,
  clientId,
  whatsappSentAt,
  whatsappSentCount,
  emailSentAt,
  emailSentCount,
}: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [waState, setWaState] = useState<WaState>("idle");
  const [emailState, setEmailState] = useState<WaState>("idle");
  const router = useRouter();
  const supabase = createClient();

  async function updateStatus(newStatus: "paid" | "sent") {
    setLoadingAction(newStatus);
    const update: Record<string, unknown> = { status: newStatus };
    if (newStatus === "paid") {
      update.montant_recu = totalTtc;
      update.montant_paye = totalTtc;
      update.reste_a_payer = 0;
    }
    await supabase.from("invoices").update(update).eq("id", invoiceId);
    router.refresh();
    setLoadingAction(null);
  }

  async function downloadPDF() {
    setLoadingAction("pdf");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const match = (res.headers.get("content-disposition") ?? "").match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match ? match[1] : "facture.pdf";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
    } catch (e: any) {
      toast.error(translateError(e), { duration: 8000 });
    } finally {
      setLoadingAction(null);
    }
  }

  async function sendWhatsApp() {
    setWaState("loading");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const { whatsappUrl } = await res.json();
      window.open(whatsappUrl, "_blank");
      setWaState("success");
      toast.success("WhatsApp ouvert avec la facture en pièce jointe");
      router.refresh();
      setTimeout(() => setWaState("idle"), 2500);
    } catch (e: any) {
      setWaState("error");
      toast.error(translateError(e), { duration: 6000 });
      setTimeout(() => setWaState("idle"), 2500);
    }
  }

  async function sendEmail() {
    let recipientEmail = clientEmail?.trim() ?? "";
    if (!recipientEmail) {
      recipientEmail = window.prompt(
        "Aucun email n'est enregistré pour ce client. Saisissez l'adresse du destinataire :",
        "",
      )?.trim() ?? "";
      if (!recipientEmail) return;
    }

    setEmailState("loading");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientEmail }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json.error === "NO_EMAIL") {
          toast.error("Ce client n'a pas d'email enregistré", { duration: 6000 });
        } else {
          throw new Error(json.message || json.error || `HTTP ${res.status}`);
        }
        setEmailState("idle");
        return;
      }
      setEmailState("success");
      toast.success("Email envoyé avec succès");
      router.refresh();
      setTimeout(() => setEmailState("idle"), 3000);
    } catch (e: any) {
      setEmailState("error");
      toast.error(translateError(e), { duration: 6000 });
      setTimeout(() => setEmailState("idle"), 3000);
    }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <>
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4 flex flex-col gap-2">
        <div className="text-[10.5px] text-[#6B7280] uppercase tracking-[0.5px] mb-1">Actions</div>

        {status === "draft" && (
          <>
            <Link href={`/factures/${invoiceId}/modifier`} className="btn btn-outline justify-center w-full">
              <Pencil size={13} /> Modifier la facture
            </Link>
            <button
              onClick={() => updateStatus("sent")}
              disabled={!!loadingAction}
              className="btn btn-outline justify-center w-full disabled:opacity-60"
            >
              {loadingAction === "sent" ? "..." : <><Upload size={13} /> Marquer comme envoyée</>}
            </button>
            <button
              onClick={() => updateStatus("paid")}
              disabled={!!loadingAction}
              className="btn btn-gold justify-center w-full disabled:opacity-60"
            >
              {loadingAction === "paid" ? "..." : <><Check size={13} /> Marquer comme payée</>}
            </button>
          </>
        )}

        {(status === "sent" || status === "overdue") && (
          <button
            onClick={() => updateStatus("paid")}
            disabled={!!loadingAction}
            className="btn btn-gold justify-center w-full disabled:opacity-60"
          >
            {loadingAction === "paid" ? "..." : <><Check size={13} /> Marquer comme payée</>}
          </button>
        )}

        {status === "partiellement_payee" && (
          <button
            onClick={() => updateStatus("paid")}
            disabled={!!loadingAction}
            className="btn btn-gold justify-center w-full disabled:opacity-60"
          >
            {loadingAction === "paid" ? "..." : <><Check size={13} /> Solder la facture</>}
          </button>
        )}

        {status === "paid" && (
          <div className="flex items-center justify-center gap-1.5 py-1 text-center text-[12px] font-medium text-[#059669]">
            <CheckCircle2 size={14} aria-hidden="true" /> Facture payée
          </div>
        )}

        {/* Download PDF */}
        <button
          onClick={downloadPDF}
          disabled={!!loadingAction}
          className="btn btn-outline justify-center w-full disabled:opacity-60 flex items-center gap-1.5"
        >
          {loadingAction === "pdf"
            ? <><Loader2 size={13} className="animate-spin" /> Génération...</>
            : <><Download size={13} /> Télécharger PDF</>}
        </button>

        {/* WhatsApp */}
        <button
          onClick={sendWhatsApp}
          disabled={waState === "loading"}
          className={`btn justify-center w-full flex items-center gap-1.5 transition-all ${
            waState === "success" ? "bg-[#059669] text-white border-[#059669] hover:bg-[#059669]"
            : waState === "error" ? "bg-[#DC2626] text-white border-[#DC2626] hover:bg-[#DC2626]"
            : "btn-outline"
          }`}
        >
          {waState === "loading" && <><Loader2 size={13} className="animate-spin" /> Préparation...</>}
          {waState === "success" && <><Check size={13} /> WhatsApp ouvert</>}
          {waState === "error" && <><XCircle size={13} /> Erreur — réessayer</>}
          {waState === "idle" && <><Send size={13} /> Envoyer par WhatsApp</>}
        </button>

        {/* Email */}
        <button
          onClick={sendEmail}
          disabled={emailState === "loading"}
          className={`btn justify-center w-full flex items-center gap-1.5 transition-all ${
            emailState === "success" ? "bg-[#059669] text-white border-[#059669] hover:bg-[#059669]"
            : emailState === "error" ? "bg-[#DC2626] text-white border-[#DC2626] hover:bg-[#DC2626]"
            : "btn-outline"
          }`}
        >
          {emailState === "loading" && <><Loader2 size={13} className="animate-spin" /> Envoi en cours...</>}
          {emailState === "success" && <><Check size={13} /> Email envoyé</>}
          {emailState === "error" && <><XCircle size={13} /> Erreur — réessayer</>}
          {emailState === "idle" && <><Mail size={13} /> Envoyer par email</>}
        </button>

        {/* Warnings */}
        {!clientPhone && (
          <div className="text-[10.5px] text-[#D97706] bg-[#FEF3C7] rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1"><AlertTriangle size={12} /> Aucun numéro WhatsApp pour ce client</span>
            {clientId && (
              <Link href="/clients" className="text-[10px] text-[#D97706] underline hover:text-[#B45309] flex-shrink-0">
                Ajouter →
              </Link>
            )}
          </div>
        )}
        {!clientEmail && (
          <div className="text-[10.5px] text-[#D97706] bg-[#FEF3C7] rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1"><AlertTriangle size={12} /> Aucun email enregistré — il sera demandé à l&apos;envoi</span>
            {clientId && (
              <Link href="/clients" className="text-[10px] text-[#D97706] underline hover:text-[#B45309] flex-shrink-0">
                Ajouter →
              </Link>
            )}
          </div>
        )}

        {/* Send history */}
        {(whatsappSentAt || emailSentAt) && (
          <div className="flex flex-col gap-0.5 mt-1 px-0.5">
            {whatsappSentAt && (
              <div className="text-[10.5px] text-[#6B7280] flex items-center gap-1">
                <Send size={11} /> Envoyé par WhatsApp le {fmtDate(whatsappSentAt)}
                {whatsappSentCount && whatsappSentCount > 1 ? ` (×${whatsappSentCount})` : ""}
              </div>
            )}
            {emailSentAt && (
              <div className="text-[10.5px] text-[#6B7280] flex items-center gap-1">
                <Mail size={11} /> Envoyé par email le {fmtDate(emailSentAt)}
                {emailSentCount && emailSentCount > 1 ? ` (×${emailSentCount})` : ""}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Download, Loader2, Send } from "lucide-react";

type WaState = "idle" | "loading" | "success" | "error";

interface Props {
  invoiceId: string;
  status: string;
  clientPhone?: string | null;
  clientId?: string | null;
  whatsappSentAt?: string | null;
  whatsappSentCount?: number;
}

export default function InvoiceActions({
  invoiceId,
  status,
  clientPhone,
  clientId,
  whatsappSentAt,
  whatsappSentCount,
}: Props) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [waState, setWaState] = useState<WaState>("idle");
  const router = useRouter();
  const supabase = createClient();

  async function updateStatus(newStatus: "paid" | "sent") {
    setLoadingAction(newStatus);
    await supabase.from("invoices").update({ status: newStatus }).eq("id", invoiceId);
    router.refresh();
    setLoadingAction(null);
  }

  async function downloadPDF() {
    setLoadingAction("pdf");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      a.href = url;
      a.download = match ? match[1] : "facture.pdf";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la génération du PDF", { duration: 8000 });
    } finally {
      setLoadingAction(null);
    }
  }

  async function sendWhatsApp() {
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
      toast.success("WhatsApp ouvert avec la facture en pièce jointe 📲");
      router.refresh();
      setTimeout(() => setWaState("idle"), 2500);
    } catch (e: any) {
      setWaState("error");
      toast.error(e.message || "Erreur lors de l'envoi WhatsApp", { duration: 6000 });
      setTimeout(() => setWaState("idle"), 2500);
    }
  }

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit", year: "numeric" });

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-4 flex flex-col gap-2">
      <div className="text-[10.5px] text-[#6B7280] uppercase tracking-[0.5px] mb-1">Actions</div>

      {status === "draft" && (
        <>
          <Link href={`/invoices/${invoiceId}/edit`} className="btn btn-outline justify-center w-full">
            ✏️ Modifier la facture
          </Link>
          <button
            onClick={() => updateStatus("sent")}
            disabled={!!loadingAction}
            className="btn btn-outline justify-center w-full disabled:opacity-60"
          >
            {loadingAction === "sent" ? "..." : "📤 Marquer comme envoyée"}
          </button>
          <button
            onClick={() => updateStatus("paid")}
            disabled={!!loadingAction}
            className="btn btn-gold justify-center w-full disabled:opacity-60"
          >
            {loadingAction === "paid" ? "..." : "✓ Marquer comme payée"}
          </button>
        </>
      )}

      {(status === "sent" || status === "overdue") && (
        <button
          onClick={() => updateStatus("paid")}
          disabled={!!loadingAction}
          className="btn btn-gold justify-center w-full disabled:opacity-60"
        >
          {loadingAction === "paid" ? "..." : "✓ Marquer comme payée"}
        </button>
      )}

      {status === "paid" && (
        <div className="text-[12px] text-[#059669] text-center py-1 font-medium">✓ Facture payée</div>
      )}

      {/* Download PDF */}
      <button
        onClick={downloadPDF}
        disabled={!!loadingAction}
        className="btn btn-outline justify-center w-full disabled:opacity-60 flex items-center gap-1.5"
      >
        {loadingAction === "pdf" ? (
          <><Loader2 size={13} className="animate-spin" /> Génération...</>
        ) : (
          <><Download size={13} /> Télécharger PDF</>
        )}
      </button>

      {/* WhatsApp send */}
      <button
        onClick={sendWhatsApp}
        disabled={waState === "loading"}
        className={`btn justify-center w-full flex items-center gap-1.5 transition-all ${
          waState === "success"
            ? "bg-[#059669] text-white border-[#059669] hover:bg-[#059669]"
            : waState === "error"
            ? "bg-[#DC2626] text-white border-[#DC2626] hover:bg-[#DC2626]"
            : "btn-outline"
        }`}
      >
        {waState === "loading" && <><Loader2 size={13} className="animate-spin" /> Préparation...</>}
        {waState === "success" && <>✓ WhatsApp ouvert</>}
        {waState === "error" && <>❌ Erreur — réessayer</>}
        {waState === "idle" && <><Send size={13} /> Envoyer par WhatsApp</>}
      </button>

      {/* No phone warning */}
      {!clientPhone && (
        <div className="text-[10.5px] text-[#D97706] bg-[#FEF3C7] rounded-lg px-2.5 py-1.5 flex items-center justify-between gap-2">
          <span>⚠️ Aucun numéro WhatsApp pour ce client</span>
          {clientId && (
            <Link
              href="/clients"
              className="text-[10px] text-[#D97706] underline hover:text-[#B45309] flex-shrink-0"
            >
              Ajouter →
            </Link>
          )}
        </div>
      )}

      {/* WhatsApp send history */}
      {whatsappSentAt && (
        <div className="text-[10.5px] text-[#6B7280] mt-1 px-0.5">
          📲 Envoyé par WhatsApp le {fmtDate(whatsappSentAt)}
          {whatsappSentCount && whatsappSentCount > 1 ? ` (×${whatsappSentCount})` : ""}
        </div>
      )}
    </div>
  );
}

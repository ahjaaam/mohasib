"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Download, Loader2, Send } from "lucide-react";

export default function InvoiceActions({ invoiceId, status }: { invoiceId: string; status: string }) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function updateStatus(newStatus: "paid" | "sent") {
    setLoading(newStatus);
    await supabase.from("invoices").update({ status: newStatus }).eq("id", invoiceId);
    router.refresh();
    setLoading(null);
  }

  async function downloadPDF() {
    setLoading("pdf");
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
      setLoading(null);
    }
  }

  async function sendWhatsApp() {
    setLoading("whatsapp");
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/pdf`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const { whatsappUrl } = await res.json();
      window.open(whatsappUrl, "_blank");
    } catch {
      toast.error("Erreur lors de l'envoi WhatsApp");
    } finally {
      setLoading(null);
    }
  }

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
            disabled={!!loading}
            className="btn btn-outline justify-center w-full disabled:opacity-60"
          >
            {loading === "sent" ? "..." : "📤 Marquer comme envoyée"}
          </button>
          <button
            onClick={() => updateStatus("paid")}
            disabled={!!loading}
            className="btn btn-gold justify-center w-full disabled:opacity-60"
          >
            {loading === "paid" ? "..." : "✓ Marquer comme payée"}
          </button>
        </>
      )}

      {(status === "sent" || status === "overdue") && (
        <button
          onClick={() => updateStatus("paid")}
          disabled={!!loading}
          className="btn btn-gold justify-center w-full disabled:opacity-60"
        >
          {loading === "paid" ? "..." : "✓ Marquer comme payée"}
        </button>
      )}

      {status === "paid" && (
        <div className="text-[12px] text-[#059669] text-center py-1 font-medium">✓ Facture payée</div>
      )}

      <button
        onClick={downloadPDF}
        disabled={!!loading}
        className="btn btn-outline justify-center w-full disabled:opacity-60 flex items-center gap-1.5"
      >
        {loading === "pdf" ? (
          <>
            <Loader2 size={13} className="animate-spin" /> Génération...
          </>
        ) : (
          <>
            <Download size={13} /> Télécharger PDF
          </>
        )}
      </button>

      <button
        onClick={sendWhatsApp}
        disabled={!!loading}
        className="btn btn-outline justify-center w-full disabled:opacity-60 flex items-center gap-1.5"
      >
        {loading === "whatsapp" ? (
          <>
            <Loader2 size={13} className="animate-spin" /> Préparation...
          </>
        ) : (
          <>
            <Send size={13} /> Envoyer par WhatsApp
          </>
        )}
      </button>
    </div>
  );
}

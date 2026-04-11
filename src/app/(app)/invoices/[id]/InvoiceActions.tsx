"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

      <button className="btn btn-outline justify-center w-full">📄 Télécharger PDF</button>
      <button className="btn btn-outline justify-center w-full">📲 Envoyer WhatsApp</button>
    </div>
  );
}

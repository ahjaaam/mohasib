"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { CheckCircle, XCircle, Loader2, FileText } from "lucide-react";

interface DevisData {
  invoice_number: string;
  devis_objet: string | null;
  devis_expiry_date: string | null;
  devis_status: string;
  devis_conditions: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  tax_rate: number;
  issue_date: string;
  items: Array<{ description: string; quantity: number; unit_price: number; tva_rate?: number; amount: number }>;
  clients: { name: string; city?: string | null } | null;
  company: { raison_sociale?: string | null; phone?: string | null; email?: string | null; city?: string | null } | null;
}

function fmt(n: number) {
  return Number(n).toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "long", year: "numeric" });
}

export default function PublicDevisPage() {
  const { id } = useParams<{ id: string }>();
  const token = useSearchParams().get("token") ?? "";
  const [data, setData] = useState<DevisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState<"idle" | "accepting" | "refusing" | "done_accept" | "done_refuse">("idle");
  const [refuseReason, setRefuseReason] = useState("");
  const [showRefuseForm, setShowRefuseForm] = useState(false);

  useEffect(() => {
    fetch(`/api/devis/${id}/public?token=${encodeURIComponent(token)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setData)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, token]);

  async function accept() {
    setAction("accepting");
    const res = await fetch(`/api/devis/${id}/accept?token=${encodeURIComponent(token)}`, { method: "POST" });
    if (res.ok) {
      setAction("done_accept");
      setData(d => d ? { ...d, devis_status: "accepté" } : d);
    } else {
      setAction("idle");
    }
  }

  async function refuse() {
    setAction("refusing");
    const res = await fetch(`/api/devis/${id}/refuse?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: refuseReason || null }),
    });
    if (res.ok) {
      setAction("done_refuse");
      setData(d => d ? { ...d, devis_status: "refusé" } : d);
    } else {
      setAction("idle");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#C8924A]" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <FileText size={36} className="text-[#D1D5DB]" />
        <p className="text-[16px] font-semibold text-[#1A1A2E]">Devis introuvable</p>
        <p className="text-[13px] text-[#6B7280]">Ce lien est invalide ou le devis a été supprimé.</p>
      </div>
    );
  }

  const isExpired = data.devis_expiry_date && data.devis_expiry_date < new Date().toISOString().slice(0, 10) && data.devis_status !== "accepté" && data.devis_status !== "refusé";
  const isAccepted = data.devis_status === "accepté" || action === "done_accept";
  const isRefused = data.devis_status === "refusé" || action === "done_refuse";
  const alreadyDecided = isAccepted || isRefused;

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-10 px-4">
      <div className="max-w-[680px] mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] font-bold tracking-[1px] uppercase text-[#C8924A]">DEVIS</span>
              <span className="text-[11px] text-[#9CA3AF]">·</span>
              <span className="text-[12px] font-semibold text-[#1A1A2E]">{data.invoice_number}</span>
            </div>
            {data.company?.raison_sociale && (
              <p className="text-[13px] text-[#6B7280]">{data.company.raison_sociale}</p>
            )}
          </div>
          <a
            href={`/f/${id}?token=${encodeURIComponent(token)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-[#C8924A] hover:underline flex items-center gap-1"
          >
            <FileText size={13} /> Voir PDF
          </a>
        </div>

        {/* Card */}
        <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden shadow-sm">

          {/* Summary */}
          <div className="p-6 border-b border-[rgba(0,0,0,0.06)]">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                {data.clients?.name && (
                  <p className="text-[11px] text-[#9CA3AF] mb-0.5">À l&apos;attention de</p>
                )}
                <p className="text-[16px] font-bold text-[#1A1A2E]">{data.clients?.name ?? "Client"}</p>
                {data.devis_objet && (
                  <p className="text-[13px] text-[#6B7280] mt-1">Objet : {data.devis_objet}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[11px] text-[#9CA3AF]">Émis le</p>
                <p className="text-[13px] font-medium text-[#1A1A2E]">{fmtDate(data.issue_date)}</p>
                {data.devis_expiry_date && (
                  <>
                    <p className="text-[11px] text-[#9CA3AF] mt-1">Valide jusqu&apos;au</p>
                    <p className={`text-[13px] font-medium ${isExpired ? "text-[#DC2626]" : "text-[#1A1A2E]"}`}>
                      {fmtDate(data.devis_expiry_date)}
                      {isExpired && <span className="ml-1 text-[10px] text-[#DC2626]">(expiré)</span>}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.06)]">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10.5px] text-[#9CA3AF] uppercase tracking-[0.5px]">
                  <th className="text-left font-semibold pb-2">Description</th>
                  <th className="text-right font-semibold pb-2 w-10">Qté</th>
                  <th className="text-right font-semibold pb-2 w-24">P.U. HT</th>
                  <th className="text-right font-semibold pb-2 w-24">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, i) => (
                  <tr key={i} className="border-t border-[rgba(0,0,0,0.04)]">
                    <td className="py-2 text-[#1A1A2E]">{item.description}</td>
                    <td className="py-2 text-right text-[#6B7280]">{item.quantity}</td>
                    <td className="py-2 text-right text-[#6B7280]">{fmt(item.unit_price)}</td>
                    <td className="py-2 text-right font-medium text-[#1A1A2E]">{fmt(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.06)] flex justify-end">
            <div className="w-64 space-y-1.5 text-[12.5px]">
              <div className="flex justify-between text-[#6B7280]">
                <span>Total HT</span><span>{fmt(data.subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#6B7280]">
                <span>TVA ({data.tax_rate}%)</span><span>{fmt(data.tax_amount)}</span>
              </div>
              <div className="h-px bg-[rgba(0,0,0,0.08)]" />
              <div className="flex justify-between text-[14px] font-bold text-[#1A1A2E]">
                <span>Total TTC</span><span className="text-[#C8924A]">{fmt(data.total)}</span>
              </div>
            </div>
          </div>

          {/* Conditions */}
          {data.devis_conditions && (
            <div className="px-6 py-4 border-b border-[rgba(0,0,0,0.06)] bg-[#FAFAF6]">
              <p className="text-[10.5px] font-semibold text-[#C8924A] uppercase tracking-[0.6px] mb-1">Conditions</p>
              <p className="text-[12px] text-[#6B7280] whitespace-pre-wrap">{data.devis_conditions}</p>
            </div>
          )}

          {/* Action zone */}
          <div className="px-6 py-6">
            {isAccepted && (
              <div className="flex items-center gap-3 bg-[#D1FAE5] rounded-xl px-4 py-3">
                <CheckCircle size={20} className="text-[#059669] flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-[#065F46]">Devis accepté</p>
                  <p className="text-[11.5px] text-[#047857]">Merci ! L&apos;entreprise a été notifiée et vous contactera prochainement.</p>
                </div>
              </div>
            )}
            {isRefused && (
              <div className="flex items-center gap-3 bg-[#FEE2E2] rounded-xl px-4 py-3">
                <XCircle size={20} className="text-[#DC2626] flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-semibold text-[#991B1B]">Devis refusé</p>
                  <p className="text-[11.5px] text-[#B91C1C]">Votre réponse a été enregistrée.</p>
                </div>
              </div>
            )}
            {!alreadyDecided && isExpired && (
              <div className="bg-[#FEF3C7] rounded-xl px-4 py-3">
                <p className="text-[13px] font-semibold text-[#92400E]">Ce devis a expiré</p>
                <p className="text-[11.5px] text-[#B45309]">La date de validité est dépassée. Contactez l&apos;émetteur pour un nouveau devis.</p>
              </div>
            )}
            {!alreadyDecided && !isExpired && (
              <div className="flex flex-col gap-3">
                <p className="text-[12.5px] text-[#6B7280] text-center">Votre réponse :</p>
                {!showRefuseForm ? (
                  <div className="flex gap-3">
                    <button
                      onClick={accept}
                      disabled={action === "accepting"}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#059669] text-white rounded-xl py-3 text-[13px] font-semibold hover:bg-[#047857] transition-colors disabled:opacity-60"
                    >
                      {action === "accepting"
                        ? <><Loader2 size={14} className="animate-spin" /> Traitement...</>
                        : <><CheckCircle size={15} /> Accepter ce devis</>
                      }
                    </button>
                    <button
                      onClick={() => setShowRefuseForm(true)}
                      className="flex-1 flex items-center justify-center gap-2 border border-[#DC2626] text-[#DC2626] rounded-xl py-3 text-[13px] font-semibold hover:bg-[#FEE2E2] transition-colors"
                    >
                      <XCircle size={15} /> Refuser
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <textarea
                      rows={3}
                      value={refuseReason}
                      onChange={e => setRefuseReason(e.target.value)}
                      placeholder="Motif du refus (optionnel)..."
                      className="w-full border border-[rgba(0,0,0,0.12)] rounded-xl px-3 py-2 text-[12.5px] resize-none focus:outline-none focus:border-[#DC2626]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowRefuseForm(false)}
                        className="btn btn-outline flex-1 justify-center"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={refuse}
                        disabled={action === "refusing"}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#DC2626] text-white rounded-xl py-2.5 text-[13px] font-semibold hover:bg-[#B91C1C] transition-colors disabled:opacity-60"
                      >
                        {action === "refusing"
                          ? <><Loader2 size={13} className="animate-spin" /> Traitement...</>
                          : "Confirmer le refus"
                        }
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-[#9CA3AF] mt-6">
          Devis généré via{" "}
          <a href="https://mohasibai.com" className="text-[#C8924A] hover:underline">Mohasib AI</a>
        </p>
      </div>
    </div>
  );
}

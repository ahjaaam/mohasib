"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ExternalLink, Link2, Loader2, X } from "lucide-react";
import type { Transaction } from "@/types";

type Candidate = {
  document_type: "client_invoice" | "supplier_document";
  document_id: string;
  label: string;
  counterparty: string;
  document_date: string;
  total: number;
  paid: number;
  remaining: number;
  score: number;
  evidence: string[];
};

type ExistingAllocation = {
  id: string;
  amount: number;
  document_type: "client_invoice" | "supplier_document";
  document_id: string;
  label: string;
};

type AllocationData = {
  transaction: {
    id: string;
    type: "income" | "expense";
    amount: number;
    date: string;
    description: string;
  };
  allocated_total: number;
  remaining: number;
  allocations: ExistingAllocation[];
  candidates: Candidate[];
};

function mad(value: number) {
  return `${value.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("fr-MA") : "—";
}

export default function AllocateTransactionModal({
  transaction,
  dossierId,
  onClose,
  onSaved,
}: {
  transaction: Transaction;
  dossierId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<AllocationData | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSavedRef = useRef(onSaved);

  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    async function load() {
      try {
        const autoMatchResponse = await fetch("/api/payment-allocations/auto-match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transaction_ids: [transaction.id] }),
        });
        if (autoMatchResponse.ok) {
          const autoMatchResult = await autoMatchResponse.json();
          if (Number(autoMatchResult.matched ?? 0) > 0) onSavedRef.current();
        }
        const response = await fetch(
          `/api/payment-allocations?transaction_id=${encodeURIComponent(transaction.id)}`,
        );
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Impossible de charger les documents.");
        if (!active) return;
        const allocationData = payload as AllocationData;
        setData(allocationData);
        const best = allocationData.candidates[0];
        if (
          allocationData.remaining > 0
          && best?.score >= 90
          && Math.abs(best.remaining - allocationData.remaining) <= 0.01
        ) {
          setAmounts({ [best.document_id]: allocationData.remaining.toFixed(2) });
        }
      } catch (reason: any) {
        if (active) setError(reason.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [transaction.id]);

  const selected = useMemo(() => {
    if (!data) return [];
    return data.candidates
      .map(candidate => ({
        ...candidate,
        amount: Number(amounts[candidate.document_id] ?? 0),
      }))
      .filter(candidate => candidate.amount > 0);
  }, [amounts, data]);

  const selectedTotal = selected.reduce((sum, item) => sum + item.amount, 0);
  const afterAllocation = Math.max((data?.remaining ?? 0) - selectedTotal, 0);
  const invalid = selected.some(item => item.amount > item.remaining + 0.01)
    || selectedTotal > (data?.remaining ?? 0) + 0.01;

  function toggle(candidate: Candidate) {
    setAmounts(current => {
      if (Number(current[candidate.document_id] ?? 0) > 0) {
        const next = { ...current };
        delete next[candidate.document_id];
        return next;
      }
      const alreadySelected = Object.entries(current)
        .filter(([id]) => id !== candidate.document_id)
        .reduce((sum, [, value]) => sum + Number(value || 0), 0);
      const available = Math.max((data?.remaining ?? 0) - alreadySelected, 0);
      return {
        ...current,
        [candidate.document_id]: Math.min(candidate.remaining, available).toFixed(2),
      };
    });
  }

  async function save() {
    if (!data || selected.length === 0 || invalid) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/payment-allocations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transaction_id: transaction.id,
          allocations: selected.map(item => ({
            document_type: item.document_type,
            document_id: item.document_id,
            amount: item.amount,
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Impossible de confirmer l’affectation.");
      onSaved();
      onClose();
    } catch (reason: any) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      style={{ backgroundColor: "rgba(13,21,38,0.52)", backdropFilter: "blur(4px)" }}
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-black/5 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Link2 size={17} className="text-[#C8924A]" />
              <h2 className="text-[16px] font-bold text-[#1A1A2E]">Affecter la transaction</h2>
            </div>
            <p className="mt-1 text-[11.5px] text-[#6B7280]">
              {dateLabel(transaction.date)} · {transaction.description}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-[#9CA3AF] hover:bg-black/5 hover:text-[#1A1A2E]">
            <X size={17} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-px border-b border-black/5 bg-black/5">
          <div className="bg-white px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Transaction</div>
            <div className="mt-1 text-[14px] font-bold text-[#1A1A2E]">{mad(Math.abs(Number(transaction.amount)))}</div>
          </div>
          <div className="bg-white px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Déjà affecté</div>
            <div className="mt-1 text-[14px] font-bold text-[#6B7280]">{mad(data?.allocated_total ?? 0)}</div>
          </div>
          <div className="bg-white px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[#9CA3AF]">Reste à affecter</div>
            <div className="mt-1 text-[14px] font-bold text-[#C8924A]">{mad(afterAllocation)}</div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-16 text-[12px] text-[#6B7280]">
              <Loader2 size={16} className="animate-spin" /> Recherche des documents…
            </div>
          )}

          {!loading && data?.allocations.length ? (
            <section className="mb-5">
              <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Affectations confirmées
              </h3>
              <div className="divide-y divide-black/5 rounded-xl border border-emerald-100 bg-emerald-50/40">
                {data.allocations.map(allocation => (
                  <div key={allocation.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <div className="flex min-w-0 items-center gap-2 text-[12px] font-medium text-[#1A1A2E]">
                      <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                      <Link
                        href={allocation.document_type === "client_invoice"
                          ? dossierId
                            ? `/comptable-pro/dossiers/${dossierId}/factures/${allocation.document_id}`
                            : `/factures/${allocation.document_id}`
                          : dossierId
                            ? `/comptable-pro/dossiers/${dossierId}/achats?document_id=${allocation.document_id}`
                            : `/achats?document_id=${allocation.document_id}`}
                        className="flex min-w-0 items-center gap-1.5 font-semibold underline decoration-emerald-300 underline-offset-2 transition-colors hover:text-[#047857]"
                      >
                        <span className="truncate">{allocation.label}</span>
                        <ExternalLink size={11} className="shrink-0" />
                      </Link>
                    </div>
                    <span className="shrink-0 text-[12px] font-bold text-emerald-700">{mad(allocation.amount)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {!loading && data && data.remaining <= 0.009 ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-8 text-center">
              <CheckCircle2 size={22} className="mx-auto text-emerald-600" />
              <p className="mt-2 text-[13px] font-semibold text-emerald-800">Transaction entièrement affectée</p>
            </div>
          ) : null}

          {!loading && data && data.remaining > 0.009 ? (
            <section>
              <div className="mb-2 flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-[10.5px] font-semibold uppercase tracking-wide text-[#6B7280]">
                    {transaction.type === "income" ? "Factures client ouvertes" : "Documents fournisseur ouverts"}
                  </h3>
                  <p className="mt-0.5 text-[10.5px] text-[#9CA3AF]">
                    Sélectionnez un ou plusieurs documents et répartissez le montant.
                  </p>
                </div>
                <span className="text-[10.5px] text-[#9CA3AF]">{data.candidates.length} document(s)</span>
              </div>

              {data.candidates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-black/10 px-4 py-10 text-center text-[12px] text-[#6B7280]">
                  Aucun document ouvert compatible avec cette transaction.
                </div>
              ) : (
                <div className="divide-y divide-black/5 overflow-hidden rounded-xl border border-black/10">
                  {data.candidates.map(candidate => {
                    const value = amounts[candidate.document_id] ?? "";
                    const checked = Number(value) > 0;
                    return (
                      <div key={candidate.document_id} className={`grid items-center gap-3 px-3.5 py-3 sm:grid-cols-[28px_1fr_145px] ${checked ? "bg-[#FFF9EF]" : "bg-white"}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(candidate)}
                          className="h-4 w-4 accent-[#C8924A]"
                        />
                        <button type="button" onClick={() => toggle(candidate)} className="min-w-0 text-left">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-semibold text-[#1A1A2E]">{candidate.label}</span>
                            {candidate.score >= 90 && (
                              <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                                Correspondance forte
                              </span>
                            )}
                            {candidate.score >= 60 && candidate.score < 90 && (
                              <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                                Correspondance probable
                              </span>
                            )}
                          </div>
                          <div className="mt-1 truncate text-[10.5px] text-[#6B7280]">
                            {candidate.counterparty} · {dateLabel(candidate.document_date)} · Reste {mad(candidate.remaining)}
                          </div>
                          {candidate.evidence.length > 0 && (
                            <div className="mt-1 text-[9.5px] text-[#9CA3AF]">{candidate.evidence.join(" · ")}</div>
                          )}
                        </button>
                        <div>
                          <label className="mb-1 block text-[9.5px] font-medium uppercase tracking-wide text-[#9CA3AF]">
                            Montant affecté
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={Math.min(candidate.remaining, data.remaining)}
                            step="0.01"
                            disabled={!checked}
                            value={value}
                            onChange={event => setAmounts(current => ({
                              ...current,
                              [candidate.document_id]: event.target.value,
                            }))}
                            className="input text-right text-[12px] disabled:bg-gray-50 disabled:text-gray-300"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          ) : null}

          {error && (
            <div className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] text-red-700">{error}</div>
          )}
          {invalid && (
            <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-[11.5px] text-amber-800">
              Vérifiez les montants : l’affectation ne peut dépasser ni la transaction ni le solde d’un document.
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-black/5 bg-[#FAFAF8] px-5 py-3.5">
          <div className="text-[11px] text-[#6B7280]">
            Sélectionné : <strong className="text-[#1A1A2E]">{mad(selectedTotal)}</strong>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-outline">Fermer</button>
            <button
              onClick={save}
              disabled={saving || selected.length === 0 || invalid}
              className="btn btn-gold flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Confirmer l’affectation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

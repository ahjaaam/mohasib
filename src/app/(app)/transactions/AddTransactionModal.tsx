"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { X, Plus } from "lucide-react";
import { TRANSACTION_CATEGORIES } from "@/lib/utils";
import type { Client } from "@/types";

interface Props {
  userId: string;
  clients: Pick<Client, "id" | "name">[];
}

export default function AddTransactionModal({ userId, clients }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    type: "income" as "income" | "expense",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    category: "",
    client_id: "",
    payment_method: "bank_transfer",
    reference: "",
    notes: "",
    // Supplier fiscal fields
    fournisseur: "",
    if_fournisseur: "",
    ice_fournisseur: "",
    mode_paiement: "Virement",
    date_paiement: new Date().toISOString().split("T")[0],
  });

  const isExpense = form.type === "expense";
  const categories = TRANSACTION_CATEGORIES[form.type];

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: err } = await supabase.from("transactions").insert({
      user_id: userId,
      type: form.type,
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
      category: form.category || null,
      client_id: form.client_id || null,
      payment_method: form.payment_method || null,
      reference: form.reference || null,
      notes: form.notes || null,
      currency: "MAD",
      // Supplier fields (only meaningful for expenses)
      ...(isExpense && {
        fournisseur: form.fournisseur || null,
        if_fournisseur: form.if_fournisseur || null,
        ice_fournisseur: form.ice_fournisseur || null,
        mode_paiement: form.mode_paiement || null,
        date_paiement: form.date_paiement || null,
      }),
    });

    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={16} />
        Nouvelle transaction
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(13,21,38,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-navy">Nouvelle transaction</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Type toggle */}
              <div className="flex rounded-lg overflow-hidden border border-gray-200">
                {(["income", "expense"] as const).map((t) => (
                  <button key={t} type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t, category: "" }))}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      form.type === t
                        ? t === "income" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                        : "bg-white text-gray-500 hover:bg-gray-50"
                    }`}>
                    {t === "income" ? "Revenu" : "Dépense"}
                  </button>
                ))}
              </div>

              <div>
                <label className="label">Description *</label>
                <input className="input" required value={form.description}
                  onChange={(e) => set("description", e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Montant (MAD) *</label>
                  <input type="number" min="0" step="0.01" className="input" required
                    value={form.amount}
                    onChange={(e) => set("amount", e.target.value)} />
                </div>
                <div>
                  <label className="label">Date *</label>
                  <input type="date" className="input" required value={form.date}
                    onChange={(e) => set("date", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="label">Catégorie</label>
                <select className="input" value={form.category}
                  onChange={(e) => set("category", e.target.value)}>
                  <option value="">— Choisir —</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Client</label>
                <select className="input" value={form.client_id}
                  onChange={(e) => set("client_id", e.target.value)}>
                  <option value="">— Optionnel —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Moyen de paiement</label>
                <select className="input" value={form.payment_method}
                  onChange={(e) => set("payment_method", e.target.value)}>
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="cash">Espèces</option>
                  <option value="check">Chèque</option>
                  <option value="card">Carte bancaire</option>
                </select>
              </div>

              <div>
                <label className="label">Référence</label>
                <input className="input" placeholder="N° de virement, chèque..." value={form.reference}
                  onChange={(e) => set("reference", e.target.value)} />
              </div>

              {/* ── Supplier fiscal fields (expenses only) ─────────────── */}
              {isExpense && (
                <div className="border border-[rgba(0,0,0,0.08)] rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-[#1A1A2E]">Informations fournisseur</p>
                    <span className="text-[10.5px] text-[#C8924A] font-medium bg-[rgba(200,146,74,0.1)] px-2 py-0.5 rounded-full">
                      Requis pour la déclaration TVA DGI
                    </span>
                  </div>

                  <div>
                    <label className="label">Fournisseur</label>
                    <input
                      className="input"
                      placeholder="Nom du fournisseur"
                      value={form.fournisseur}
                      onChange={(e) => set("fournisseur", e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">IF Fournisseur <span className="text-[#9CA3AF] font-normal">(optionnel)</span></label>
                      <input
                        className="input"
                        placeholder="Identifiant Fiscal"
                        value={form.if_fournisseur}
                        onChange={(e) => set("if_fournisseur", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">ICE Fournisseur <span className="text-[#9CA3AF] font-normal">(optionnel)</span></label>
                      <input
                        className="input"
                        placeholder="ICE 15 chiffres"
                        value={form.ice_fournisseur}
                        onChange={(e) => set("ice_fournisseur", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Mode de paiement</label>
                      <select
                        className="input"
                        value={form.mode_paiement}
                        onChange={(e) => set("mode_paiement", e.target.value)}
                      >
                        <option value="Virement">Virement</option>
                        <option value="Chèque">Chèque</option>
                        <option value="Carte bancaire">Carte bancaire</option>
                        <option value="Espèces">Espèces</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Date de paiement</label>
                      <input
                        type="date"
                        className="input"
                        value={form.date_paiement}
                        onChange={(e) => set("date_paiement", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="btn-secondary flex-1 justify-center">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

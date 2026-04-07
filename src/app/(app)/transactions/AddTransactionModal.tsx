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
  });

  const categories = TRANSACTION_CATEGORIES[form.type];

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
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Montant (MAD) *</label>
                  <input type="number" min="0" step="0.01" className="input" required
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Date *</label>
                  <input type="date" className="input" required value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="label">Catégorie</label>
                <select className="input" value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                  <option value="">— Choisir —</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Client</label>
                <select className="input" value={form.client_id}
                  onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}>
                  <option value="">— Optionnel —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="label">Moyen de paiement</label>
                <select className="input" value={form.payment_method}
                  onChange={(e) => setForm((f) => ({ ...f, payment_method: e.target.value }))}>
                  <option value="bank_transfer">Virement bancaire</option>
                  <option value="cash">Espèces</option>
                  <option value="check">Chèque</option>
                  <option value="card">Carte bancaire</option>
                </select>
              </div>

              <div>
                <label className="label">Référence</label>
                <input className="input" placeholder="N° de virement, chèque..." value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
              </div>

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

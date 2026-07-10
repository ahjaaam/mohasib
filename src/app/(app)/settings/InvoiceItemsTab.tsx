"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { translateError } from "@/lib/errors";
import toast from "react-hot-toast";
import { Plus, Save, Trash2 } from "lucide-react";

type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string | null;
  unit_price: number | string;
  tva_rate: number | string;
  is_active: boolean;
};

interface Props {
  userId: string;
}

const TVA_RATES = [0, 7, 10, 14, 20];
const UNITS = ["unité", "mois", "heure", "jour", "pièce", "service"];

function emptyForm() {
  return {
    name: "",
    description: "",
    category: "",
    unit: "unité",
    unit_price: "",
    tva_rate: 20,
  };
}

function money(value: number | string) {
  return Number(value || 0).toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}

export default function InvoiceItemsTab({ userId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from("invoice_items_catalog")
      .select("id, name, description, category, unit, unit_price, tva_rate, is_active")
      .eq("user_id", userId)
      .order("name");
    setLoading(false);
    if (error) toast.error(translateError(error));
    else setItems((data ?? []) as CatalogItem[]);
  }

  useEffect(() => {
    loadItems();
  }, [userId]);

  function set(key: keyof ReturnType<typeof emptyForm>, value: string | number) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function createItem() {
    if (!form.name.trim()) {
      toast.error("Nom de l’article requis");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("invoice_items_catalog").insert({
      user_id: userId,
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      unit: form.unit || "unité",
      unit_price: Number(form.unit_price || 0),
      tva_rate: Number(form.tva_rate || 0),
      is_active: true,
    });
    setSaving(false);
    if (error) toast.error(translateError(error));
    else {
      toast.success("Article enregistré");
      setForm(emptyForm());
      loadItems();
    }
  }

  async function toggleActive(item: CatalogItem) {
    const { error } = await supabase
      .from("invoice_items_catalog")
      .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("user_id", userId);
    if (error) toast.error(translateError(error));
    else loadItems();
  }

  async function deleteItem(item: CatalogItem) {
    if (!confirm(`Supprimer "${item.name}" ?`)) return;
    const { error } = await supabase
      .from("invoice_items_catalog")
      .delete()
      .eq("id", item.id)
      .eq("user_id", userId);
    if (error) toast.error(translateError(error));
    else {
      toast.success("Article supprimé");
      loadItems();
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
        <div className="mb-4">
          <h3 className="text-[14px] font-semibold text-[#1A1A2E]">Articles & prestations</h3>
          <p className="mt-1 text-[12px] leading-5 text-[#6B7280]">
            Enregistrez les produits, services ou prestations que vous facturez souvent. Vous pourrez les sélectionner directement dans une nouvelle facture.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-[#6B7280]">Nom *</span>
            <input className="input" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ex: Abonnement mensuel" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-[#6B7280]">Catégorie</span>
            <input className="input" value={form.category} onChange={e => set("category", e.target.value)} placeholder="Ex: Service, Conseil, Produit" />
          </label>
          <label className="flex flex-col gap-1.5 md:col-span-2">
            <span className="text-[11px] font-medium text-[#6B7280]">Description sur la facture</span>
            <input className="input" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Texte qui remplira la ligne de facture" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-[#6B7280]">Prix unitaire HT</span>
            <input type="number" min={0} step={0.01} className="input" value={form.unit_price} onChange={e => set("unit_price", e.target.value)} placeholder="0" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-[#6B7280]">Unité</span>
              <select className="input" value={form.unit} onChange={e => set("unit", e.target.value)}>
                {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-[#6B7280]">TVA</span>
              <select className="input" value={form.tva_rate} onChange={e => set("tva_rate", Number(e.target.value))}>
                {TVA_RATES.map(rate => <option key={rate} value={rate}>{rate}%</option>)}
              </select>
            </label>
          </div>
        </div>

        <button onClick={createItem} disabled={saving} className="btn btn-gold mt-4 inline-flex items-center gap-1.5">
          {saving ? <><Save size={13} /> Enregistrement...</> : <><Plus size={13} /> Ajouter l’article</>}
        </button>
      </div>

      <div className="rounded-xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
        <h3 className="mb-3 text-[13px] font-semibold text-[#1A1A2E]">Catalogue enregistré</h3>
        {loading && <p className="text-[12px] text-[#6B7280]">Chargement...</p>}
        {!loading && items.length === 0 && (
          <p className="rounded-lg bg-[#FAFAF6] px-4 py-3 text-[12px] text-[#6B7280]">
            Aucun article enregistré pour le moment.
          </p>
        )}
        {!loading && items.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-[rgba(0,0,0,0.06)]">
            <table className="w-full text-left text-[12px]">
              <thead className="bg-[#FAFAF6] text-[10.5px] uppercase tracking-[0.5px] text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2">Article</th>
                  <th className="px-3 py-2">Prix HT</th>
                  <th className="px-3 py-2">TVA</th>
                  <th className="px-3 py-2">Statut</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-t border-[rgba(0,0,0,0.06)]">
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-[#1A1A2E]">{item.name}</div>
                      <div className="mt-0.5 text-[11px] text-[#6B7280]">{item.description || item.category || "—"}</div>
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-[#1A1A2E]">{money(item.unit_price)}</td>
                    <td className="px-3 py-2.5">{Number(item.tva_rate)}%</td>
                    <td className="px-3 py-2.5">
                      <button
                        onClick={() => toggleActive(item)}
                        className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${item.is_active ? "bg-[#DCFCE7] text-[#047857]" : "bg-[#F3F4F6] text-[#6B7280]"}`}
                      >
                        {item.is_active ? "Actif" : "Masqué"}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => deleteItem(item)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#FEE2E2] text-[#DC2626] hover:bg-[#FCA5A5]">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

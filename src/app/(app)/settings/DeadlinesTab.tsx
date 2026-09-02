"use client";

import { useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";
import { mergeDashboardDeadlines, type DashboardDeadline } from "@/lib/dashboard-deadlines";
import { translateError } from "@/lib/errors";

interface Props {
  userId: string;
  deadlines: DashboardDeadline[] | null;
  tvaRegime?: string | null;
  tvaAssujetti?: boolean | null;
}

function newDeadline(): DashboardDeadline {
  return {
    id: crypto.randomUUID(),
    title: "",
    date: new Date().toISOString().slice(0, 10),
    link: "",
    source: "manual",
  };
}

export default function DeadlinesTab({ userId, deadlines, tvaRegime, tvaAssujetti }: Props) {
  const supabase = createClient();
  const [items, setItems] = useState<DashboardDeadline[]>(
    mergeDashboardDeadlines(deadlines, new Date(), { tvaRegime, tvaAssujetti }),
  );
  const [saving, setSaving] = useState(false);

  function update(id: string, field: keyof DashboardDeadline, value: string) {
    setItems(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));
  }

  async function save() {
    if (items.some(item => !item.title.trim() || !item.date)) {
      toast.error("Ajoutez un titre et une date pour chaque échéance");
      return;
    }

    setSaving(true);
    const cleanItems = items.map(item => ({
      ...item,
      title: item.title.trim(),
      link: item.link?.trim() || "",
    }));
    const { error } = await supabase.from("user_preferences").upsert({
      user_id: userId,
      dashboard_deadlines: cleanItems,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSaving(false);

    if (error) toast.error(translateError(error));
    else {
      setItems(cleanItems);
      toast.success("Échéances enregistrées");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-[13px] font-semibold text-[#1A1A2E]">Prochaines échéances</h3>
            <p className="text-[11.5px] text-[#9CA3AF] mt-0.5">
              Les échéances automatiques se recalculent selon votre régime TVA. Vous pouvez aussi ajouter vos rappels manuels.
            </p>
          </div>
          <button onClick={() => setItems(current => [...current, newDeadline()])} className="btn btn-outline btn-sm flex-shrink-0">
            <Plus size={14} />
            Ajouter
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          {items.length === 0 && (
            <div className="border border-dashed border-[rgba(0,0,0,0.14)] rounded-lg py-8 text-center">
              <CalendarDays size={20} className="mx-auto mb-2 text-[#9CA3AF]" />
              <p className="text-[12px] text-[#6B7280]">Aucune échéance configurée</p>
            </div>
          )}
          {items.map(item => (
            <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_150px_1fr_34px] gap-2 items-end p-3 bg-[#FAFAF6] border border-[rgba(0,0,0,0.06)] rounded-lg">
              <label className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-[10.5px] font-medium text-[#6B7280]">
                  Intitulé
                  {item.source === "automatic" && <span className="rounded-full bg-[#EAF7EF] px-2 py-0.5 text-[9px] font-bold text-[#059669]">Auto</span>}
                </span>
                <input className="input" value={item.title} onChange={event => update(item.id, "title", event.target.value)} placeholder="Ex: Déclaration TVA" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] font-medium text-[#6B7280]">
                  {item.source === "automatic" ? "Date automatique" : "Date"}
                </span>
                <input
                  type="date"
                  className="input disabled:cursor-not-allowed disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]"
                  value={item.date}
                  disabled={item.source === "automatic"}
                  onChange={event => update(item.id, "date", event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10.5px] font-medium text-[#6B7280]">Lien facultatif</span>
                <input type="url" className="input" value={item.link ?? ""} onChange={event => update(item.id, "link", event.target.value)} placeholder="https://..." />
              </label>
              <button
                onClick={() => setItems(current => current.filter(currentItem => currentItem.id !== item.id))}
                disabled={item.source === "automatic"}
                className="h-[34px] w-[34px] flex items-center justify-center rounded-lg border border-[#FECACA] text-[#DC2626] hover:bg-[#FEF2F2] transition-colors"
                title={item.source === "automatic" ? "Échéance automatique" : "Supprimer l'échéance"}
                aria-label={item.source === "automatic" ? "Échéance automatique" : "Supprimer l'échéance"}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn btn-gold self-start justify-center py-2.5 disabled:opacity-60">
        {saving ? "Enregistrement..." : "Enregistrer les échéances"}
      </button>
    </div>
  );
}

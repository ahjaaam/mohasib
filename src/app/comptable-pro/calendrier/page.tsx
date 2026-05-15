"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronLeft, ChevronRight, Plus, X, Loader2, Trash2, Calendar } from "lucide-react";
import toast from "react-hot-toast";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Category = "tva" | "ir" | "is" | "cnss" | "patente" | "custom" | "rappel";

interface FiscalEvent {
  id: string;
  day: number;
  title: string;
  category: Category;
  fiscal: true;
}

interface CustomEvent {
  id: string;
  title: string;
  date: string;
  category: Category;
  description: string | null;
  color: string | null;
  dossier_id: string | null;
}

type CalEvent = (FiscalEvent | (CustomEvent & { day: number; fiscal: false }));

// ─── Constants ─────────────────────────────────────────────────────────────────

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                   "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const CAT_BG: Record<Category, string> = {
  tva:     "#DBEAFE", ir:     "#FEF3C7", is:     "#EDE9FE",
  cnss:    "#D1FAE5", patente: "#FEE2E2", custom: "#F3F4F6", rappel: "#F3F4F6",
};
const CAT_TEXT: Record<Category, string> = {
  tva:     "#1D4ED8", ir:     "#92400E", is:     "#7C3AED",
  cnss:    "#065F46", patente: "#991B1B", custom: "#374151", rappel: "#374151",
};
const CAT_DOT: Record<Category, string> = {
  tva: "#3B82F6", ir: "#F59E0B", is: "#8B5CF6",
  cnss: "#10B981", patente: "#EF4444", custom: "#6B7280", rappel: "#6B7280",
};

const CATEGORIES: { value: Category; label: string }[] = [
  { value: "rappel",  label: "Rappel / Tâche" },
  { value: "tva",     label: "TVA" },
  { value: "ir",      label: "IR" },
  { value: "is",      label: "IS" },
  { value: "cnss",    label: "CNSS / Salaires" },
  { value: "patente", label: "Patente / TP" },
  { value: "custom",  label: "Autre" },
];

// ─── Fiscal event generation ────────────────────────────────────────────────────

function fiscalEventsForMonth(year: number, month: number): FiscalEvent[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const clamp = (d: number) => Math.min(d, daysInMonth);
  const ev = (day: number, title: string, cat: Category): FiscalEvent =>
    ({ id: `fiscal-${month}-${day}-${cat}`, day: clamp(day), title, category: cat, fiscal: true });

  const list: FiscalEvent[] = [
    ev(10, "CNSS & IR salaires (mois précédent)", "cnss"),
    ev(20, "TVA mensuelle", "tva"),
  ];

  if ([4, 7, 10, 1].includes(month)) list.push(ev(20, "TVA trimestrielle", "tva"));
  if ([3, 6, 9, 12].includes(month)) list.push(ev(31, "Acompte IS (25%)", "is"));
  if (month === 3) {
    list.push(ev(31, "Déclaration IS (solde)", "is"));
    list.push(ev(31, "Taxe professionnelle", "patente"));
  }
  if (month === 1) list.push(ev(31, "Patente / TP — dernier délai", "patente"));
  if (month === 5) list.push(ev(31, "Déclaration IR (revenus N-1)", "ir"));

  return list;
}

// ─── Event chip ────────────────────────────────────────────────────────────────

function EventChip({ title, category, onClick }: {
  title: string; category: Category; onClick?: () => void;
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); onClick?.(); }}
      className="w-full text-left text-[10px] font-semibold px-1.5 py-0.5 rounded leading-snug whitespace-normal break-words"
      style={{ backgroundColor: CAT_BG[category], color: CAT_TEXT[category] }}
    >
      {title}
    </button>
  );
}

// ─── Add/view event modal ──────────────────────────────────────────────────────

interface ModalProps {
  date: string;
  dayEvents: CalEvent[];
  dossiers: { id: string; raison_sociale: string }[];
  onClose: () => void;
  onSave: (data: { title: string; category: Category; description: string; dossier_id: string; date: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  saving: boolean;
}

function EventModal({ date, dayEvents, dossiers, onClose, onSave, onDelete, saving }: ModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("rappel");
  const [description, setDescription] = useState("");
  const [dossierId, setDossierId] = useState("");
  const [showForm, setShowForm] = useState(dayEvents.length === 0);

  const d = new Date(date + "T00:00:00");
  const dayLabel = `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;

  async function submit() {
    if (!title.trim()) { toast.error("Titre requis"); return; }
    await onSave({ title: title.trim(), category, description, dossier_id: dossierId, date });
    setTitle(""); setDescription(""); setShowForm(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.07)]">
          <div>
            <div className="text-[14px] font-bold text-[#1A1A2E]">{dayLabel}</div>
            <div className="text-[11px] text-[#9CA3AF] mt-0.5">
              {dayEvents.length} événement{dayEvents.length !== 1 ? "s" : ""}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-1 text-[12px] font-medium text-[#C8924A] hover:underline">
                <Plus size={13} /> Ajouter
              </button>
            )}
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-[#9CA3AF] hover:bg-[#F3F4F6] transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Existing events */}
          {dayEvents.length > 0 && (
            <div className="space-y-2">
              {dayEvents.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 p-3 rounded-xl border border-[rgba(0,0,0,0.07)]">
                  <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                    style={{ backgroundColor: CAT_DOT[ev.category] }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-[#1A1A2E] leading-tight">{ev.title}</div>
                    <div className="text-[11px] text-[#9CA3AF] mt-0.5 capitalize">{ev.category}</div>
                    {"description" in ev && ev.description && (
                      <div className="text-[11.5px] text-[#6B7280] mt-1">{ev.description}</div>
                    )}
                  </div>
                  {"fiscal" in ev && ev.fiscal ? (
                    <span className="text-[9.5px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CAT_BG[ev.category], color: CAT_TEXT[ev.category] }}>
                      Fiscal
                    </span>
                  ) : (
                    <button onClick={() => onDelete(ev.id)}
                      className="text-[#D1D5DB] hover:text-[#DC2626] transition-colors flex-shrink-0">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add form */}
          {showForm && (
            <div className="space-y-3 pt-1">
              {dayEvents.length > 0 && (
                <div className="h-px bg-[rgba(0,0,0,0.07)]" />
              )}
              <div>
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Titre *</label>
                <input autoFocus className="input" placeholder="Ex: Appel client, dépôt déclaration..."
                  value={title} onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submit()} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Catégorie</label>
                <select className="input" value={category} onChange={e => setCategory(e.target.value as Category)}>
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              {dossiers.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Dossier client (optionnel)</label>
                  <select className="input" value={dossierId} onChange={e => setDossierId(e.target.value)}>
                    <option value="">— Aucun —</option>
                    {dossiers.map(d => <option key={d.id} value={d.id}>{d.raison_sociale}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide mb-1">Note (optionnel)</label>
                <textarea className="input resize-none" rows={2} placeholder="Description, remarque..."
                  value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-1">
                {dayEvents.length > 0 && (
                  <button onClick={() => setShowForm(false)} className="btn btn-outline flex-1">Annuler</button>
                )}
                <button onClick={submit} disabled={saving} className="btn btn-gold flex-1 flex items-center justify-center gap-1.5">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Ajouter
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main calendar component ───────────────────────────────────────────────────

export default function CalendrierPage() {
  const supabase = createClient();
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];

  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
  const [dossiers, setDossiers] = useState<{ id: string; raison_sociale: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");

  // ── Load data ────────────────────────────────────────────────────────────────

  const loadEvents = useCallback(async (uid: string, y: number, m: number) => {
    const startDate = `${y}-${String(m).padStart(2, "0")}-01`;
    const endDate = `${y}-${String(m).padStart(2, "0")}-${new Date(y, m, 0).getDate()}`;
    const { data } = await supabase
      .from("fiduciaire_events")
      .select("*")
      .eq("fiduciaire_user_id", uid)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date");
    setCustomEvents((data ?? []) as CustomEvent[]);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserId(user.id);
      loadEvents(user.id, year, month);
      supabase.from("dossiers").select("id, raison_sociale")
        .eq("fiduciaire_user_id", user.id).order("raison_sociale")
        .then(({ data }) => setDossiers(data ?? []));
    });
  }, []);

  useEffect(() => {
    if (userId) loadEvents(userId, year, month);
  }, [year, month, userId]);

  // ── Navigation ────────────────────────────────────────────────────────────────

  function prev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }
  function goToday() { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); }

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  async function saveEvent(data: { title: string; category: Category; description: string; dossier_id: string; date: string }) {
    setSaving(true);
    const { error } = await supabase.from("fiduciaire_events").insert({
      fiduciaire_user_id: userId,
      title: data.title,
      date: data.date,
      category: data.category,
      description: data.description || null,
      dossier_id: data.dossier_id || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Événement ajouté !");
    await loadEvents(userId, year, month);
  }

  async function deleteEvent(id: string) {
    const { error } = await supabase.from("fiduciaire_events").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Événement supprimé");
    await loadEvents(userId, year, month);
  }

  // ── Calendar grid ─────────────────────────────────────────────────────────────

  const fiscalEvents = fiscalEventsForMonth(year, month);
  const daysInMonth  = new Date(year, month, 0).getDate();

  // Mon-first offset (0=Mon … 6=Sun)
  const rawFirst    = new Date(year, month - 1, 1).getDay();
  const startOffset = (rawFirst + 6) % 7;
  const totalCells  = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  // Build day → events map
  const eventsByDay: Record<number, CalEvent[]> = {};
  for (const e of fiscalEvents) {
    if (!eventsByDay[e.day]) eventsByDay[e.day] = [];
    eventsByDay[e.day].push(e);
  }
  for (const e of customEvents) {
    const d = parseInt(e.date.split("-")[2], 10);
    if (!eventsByDay[d]) eventsByDay[d] = [];
    eventsByDay[d].push({ ...e, day: d, fiscal: false });
  }

  // ── Events for selected date modal ────────────────────────────────────────────

  const selectedDay  = selectedDate ? parseInt(selectedDate.split("-")[2], 10) : null;
  const modalEvents  = selectedDay != null ? (eventsByDay[selectedDay] ?? []) : [];

  // ─── Render ────────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── Page title ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-11 h-11 rounded-xl bg-[rgba(200,146,74,0.12)] flex items-center justify-center flex-shrink-0">
          <Calendar size={20} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#1A1A2E] leading-tight">Calendrier comptable</h1>
          <p className="text-[12.5px] text-[#6B7280]">Échéances fiscales et sociales — Maroc</p>
        </div>
      </div>

      {/* ── Controls ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={prev}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.10)] bg-white hover:border-[#C8924A] transition-colors">
            <ChevronLeft size={15} />
          </button>
          <h2 className="text-[16px] font-bold text-[#1A1A2E] min-w-[180px] text-center select-none">
            {MONTHS_FR[month - 1]} {year}
          </h2>
          <button onClick={next}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.10)] bg-white hover:border-[#C8924A] transition-colors">
            <ChevronRight size={15} />
          </button>
        </div>
        <button onClick={goToday}
          className="text-[12px] font-medium text-[#6B7280] border border-[rgba(0,0,0,0.10)] bg-white px-3 py-1.5 rounded-lg hover:border-[#C8924A] hover:text-[#C8924A] transition-colors">
          Aujourd'hui
        </button>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Legend */}
          {(["tva", "ir", "is", "cnss", "patente", "rappel"] as Category[]).map(cat => (
            <span key={cat} className="hidden md:flex items-center gap-1 text-[10.5px] font-medium">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CAT_DOT[cat] }} />
              <span className="text-[#6B7280]">{CATEGORIES.find(c => c.value === cat)?.label}</span>
            </span>
          ))}
          <button onClick={() => {
            const y = String(year);
            const m = String(month).padStart(2, "0");
            setSelectedDate(`${y}-${m}-${String(now.getDate()).padStart(2, "0")}`);
          }} className="btn btn-gold btn-sm flex items-center gap-1.5">
            <Plus size={13} /> Événement
          </button>
        </div>
      </div>

      {/* ── Calendar grid ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-2xl overflow-hidden flex-1"
        style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 border-b border-[rgba(0,0,0,0.07)]">
          {DAYS_FR.map((d, i) => (
            <div key={d} className={`py-2.5 text-center text-[11.5px] font-semibold uppercase tracking-wide select-none ${
              i >= 5 ? "text-[#C8924A]" : "text-[#6B7280]"
            }`}>
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 flex-1"
          style={{ gridAutoRows: `minmax(90px, 1fr)` }}>
          {Array.from({ length: totalCells }).map((_, idx) => {
            const dayNum = idx - startOffset + 1;
            const isValid = dayNum >= 1 && dayNum <= daysInMonth;
            if (!isValid) {
              return <div key={idx} className="border-b border-r border-[rgba(0,0,0,0.05)] bg-[#FAFAFA]" />;
            }

            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const isWeekend = (idx % 7) >= 5;
            const events = eventsByDay[dayNum] ?? [];
            const MAX_VISIBLE = 3;
            const visible = events.slice(0, MAX_VISIBLE);
            const overflow = events.length - MAX_VISIBLE;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(dateStr)}
                className={`border-b border-r border-[rgba(0,0,0,0.05)] p-1.5 cursor-pointer transition-colors relative group ${
                  isWeekend ? "bg-[#FFFDF8]" : "bg-white"
                } hover:bg-[rgba(200,146,74,0.04)] ${
                  isSelected ? "ring-1 ring-inset ring-[#C8924A]" : ""
                }`}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[12px] font-semibold leading-none w-6 h-6 flex items-center justify-center rounded-full select-none ${
                    isToday
                      ? "bg-[#C8924A] text-white"
                      : isWeekend
                        ? "text-[#C8924A]"
                        : "text-[#374151]"
                  }`}>
                    {dayNum}
                  </span>
                  {/* Quick add on hover */}
                  <button
                    onClick={e => { e.stopPropagation(); setSelectedDate(dateStr); }}
                    className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded text-[#C8924A] hover:bg-[rgba(200,146,74,0.12)] transition-all"
                  >
                    <Plus size={11} />
                  </button>
                </div>

                {/* Events */}
                <div className="space-y-0.5">
                  {visible.map(ev => (
                    <EventChip
                      key={ev.id}
                      title={ev.title}
                      category={ev.category}
                      onClick={() => setSelectedDate(dateStr)}
                    />
                  ))}
                  {overflow > 0 && (
                    <div className="text-[9.5px] text-[#9CA3AF] pl-1 font-medium">
                      +{overflow} autre{overflow > 1 ? "s" : ""}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Event modal ─────────────────────────────────────────────────────── */}
      {selectedDate && (
        <EventModal
          date={selectedDate}
          dayEvents={modalEvents}
          dossiers={dossiers}
          onClose={() => setSelectedDate(null)}
          onSave={saveEvent}
          onDelete={deleteEvent}
          saving={saving}
        />
      )}
    </div>
  );
}

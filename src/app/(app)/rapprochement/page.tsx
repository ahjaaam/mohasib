"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Check, Download, FilePlus2, GitMerge, History, Search, SkipForward } from "lucide-react";

type Session = {
  id: string;
  company_id: string | null;
  dossier_id: string | null;
  periode_debut: string;
  periode_fin: string;
  solde_final_banque: number;
  solde_final_comptable: number;
  ecart: number;
  statut: string;
  is_balanced: boolean;
  validated_at: string | null;
  created_at: string;
};

type Line = {
  id: string;
  bank_date: string;
  bank_description: string;
  bank_amount: number;
  bank_reference: string | null;
  ecriture_id: string | null;
  dossier_ecriture_id: string | null;
  statut: string;
  match_confidence: number;
  match_method: string | null;
};

type Ecriture = {
  id: string;
  date_ecriture: string;
  journal: string;
  compte: string;
  compte_label: string | null;
  debit: number;
  credit: number;
  libelle: string | null;
  source_type: string | null;
  source_id: string | null;
};

const today = new Date();
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);

function mad(value: number) {
  return `${Number(value || 0).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

function classForStatus(status: string) {
  if (status === "rapproché") return "border-l-[#059669]";
  if (status === "en_attente") return "border-l-[#C8924A]";
  if (status === "ignoré") return "border-l-[#9CA3AF] opacity-60";
  return "border-l-[#DC2626]";
}

function confidenceLabel(confidence: number) {
  if (confidence >= 0.9) return { label: "Haute confiance", className: "bg-[#ECFDF5] text-[#047857]" };
  if (confidence >= 0.7) return { label: "À confirmer", className: "bg-[#FFF7ED] text-[#B45309]" };
  return { label: "Non rapproché", className: "bg-[#FEE2E2] text-[#B91C1C]" };
}

export default function RapprochementPage({ dossierId }: { dossierId?: string }) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Session | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [ecritures, setEcritures] = useState<Ecriture[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [filter, setFilter] = useState("Toutes");
  const [entryFilter, setEntryFilter] = useState("Toutes");
  const [mobileTab, setMobileTab] = useState<"bank" | "entries">("bank");
  const [form, setForm] = useState({
    periodeDebut: monthStart,
    periodeFin: monthEnd,
    soldeBancaireInitial: "0",
    soldeBancaireFinal: "0",
  });

  async function loadSessions(sessionId?: string | null) {
    setLoading(true);
    const query = supabase
      .from("rapprochement_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    const { data } = await (dossierId ? query.eq("dossier_id", dossierId) : query.is("dossier_id", null));
    const list = (data ?? []) as Session[];
    const target = list.find((item) => item.id === sessionId) ?? list[0] ?? null;
    setSelected(target);
    setLoading(false);
  }

  async function loadWorkspace(session: Session | null) {
    if (!session) {
      setLines([]);
      setEcritures([]);
      return;
    }
    const [{ data: lineData }, { data: entryData }] = await Promise.all([
      supabase.from("rapprochement_lignes").select("*").eq("session_id", session.id).order("bank_date", { ascending: true }),
      dossierId
        ? supabase.from("dossier_ecritures")
            .select("id, date, journal, compte_cgnc, debit, credit, libelle")
            .eq("dossier_id", dossierId).eq("compte_cgnc", "5141")
            .gte("date", session.periode_debut).lte("date", session.periode_fin).order("date")
        : supabase.from("ecritures_comptables")
            .select("id, date_ecriture, journal, compte, compte_label, debit, credit, libelle, source_type, source_id")
            .eq("compte", "5141").is("dossier_id", null)
            .gte("date_ecriture", session.periode_debut).lte("date_ecriture", session.periode_fin).order("date_ecriture"),
    ]);
    setLines((lineData ?? []) as Line[]);
    setEcritures((entryData ?? []).map((entry: any) => ({
      ...entry,
      date_ecriture: entry.date_ecriture ?? entry.date,
      compte: entry.compte ?? entry.compte_cgnc,
      compte_label: entry.compte_label ?? null,
      source_type: entry.source_type ?? null,
      source_id: entry.source_id ?? null,
    })) as Ecriture[]);
  }

  useEffect(() => {
    loadSessions(searchParams.get("session"));
  }, [dossierId]);

  useEffect(() => {
    loadWorkspace(selected);
  }, [selected?.id]);

  function quickSelect(kind: "month" | "last" | "quarter") {
    const now = new Date();
    if (kind === "last") {
      setForm((prev) => ({
        ...prev,
        periodeDebut: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10),
        periodeFin: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10),
      }));
      return;
    }
    if (kind === "quarter") {
      const q = Math.floor(now.getMonth() / 3) * 3;
      setForm((prev) => ({
        ...prev,
        periodeDebut: new Date(now.getFullYear(), q, 1).toISOString().slice(0, 10),
        periodeFin: new Date(now.getFullYear(), q + 3, 0).toISOString().slice(0, 10),
      }));
      return;
    }
    setForm((prev) => ({ ...prev, periodeDebut: monthStart, periodeFin: monthEnd }));
  }

  async function start() {
    setStarting(true);
    const res = await fetch("/api/rapprochement/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        soldeBancaireInitial: Number(form.soldeBancaireInitial),
        soldeBancaireFinal: Number(form.soldeBancaireFinal),
        dossierId,
      }),
    });
    const json = await res.json();
    setStarting(false);
    if (json.sessionId) {
      router.replace(dossierId ? `/comptable-pro/dossiers/${dossierId}/rapprochement?session=${json.sessionId}` : `/rapprochement?session=${json.sessionId}`);
      await loadSessions(json.sessionId);
    }
  }

  async function postAction(path: string, body: Record<string, any> = {}) {
    if (!selected) return;
    await fetch(`/api/rapprochement/${selected.id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await loadSessions(selected.id);
  }

  const lineStats = useMemo(() => {
    const matched = lines.filter((line) => line.statut === "rapproché").length;
    const total = lines.length;
    return { matched, total, pct: total ? Math.round((matched / total) * 100) : 0 };
  }, [lines]);

  const filteredLines = lines.filter((line) => {
    if (filter === "Non rapprochées") return line.statut === "non_rapproché" || line.statut === "en_attente";
    if (filter === "Rapprochées") return line.statut === "rapproché";
    if (filter === "Ignorées") return line.statut === "ignoré";
    return true;
  });

  const matchedEcritureIds = new Set(lines.filter((line) => line.statut === "rapproché").map((line) => line.ecriture_id ?? line.dossier_ecriture_id).filter(Boolean));
  const filteredEcritures = ecritures.filter((entry) => {
    const matched = matchedEcritureIds.has(entry.id);
    if (entryFilter === "Non rapprochées") return !matched;
    if (entryFilter === "Rapprochées") return matched;
    return true;
  });

  if (loading) return <div className="loading-state">Chargement des rapprochements…</div>;

  return (
    <div>
      {/* ─── Page header ──────────────────────────────────────────────────── */}
      <div className="mb-5 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,146,74,0.12)" }}>
            <GitMerge size={18} className="text-[#C8924A]" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Rapprochement bancaire</h1>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Comparez vos mouvements bancaires avec vos écritures comptables.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={dossierId ? `/comptable-pro/dossiers/${dossierId}/rapprochement/historique` : "/rapprochement/historique"} className="btn btn-outline btn-sm flex items-center gap-1.5">
            <History size={13} /> Historique
          </Link>
          {selected && (
            <a href={`/api/rapprochement/${selected.id}/report`} className="btn btn-outline btn-sm flex items-center gap-1.5">
              <Download size={13} /> Rapport PDF
            </a>
          )}
        </div>
      </div>

      <div className="space-y-5">
        <section className="border-y border-[rgba(0,0,0,0.08)] py-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[13.5px] font-semibold text-[#1A1A2E]">Nouveau rapprochement</h2>
              <p className="mt-0.5 text-[11px] text-[#9CA3AF]">Saisissez les soldes figurant sur votre relevé bancaire.</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-[11px] font-semibold text-[#6B7280]">Date début
              <input type="date" value={form.periodeDebut} onChange={(e) => setForm({ ...form, periodeDebut: e.target.value })} className="input mt-1 w-full" />
            </label>
            <label className="text-[11px] font-semibold text-[#6B7280]">Date fin
              <input type="date" value={form.periodeFin} onChange={(e) => setForm({ ...form, periodeFin: e.target.value })} className="input mt-1 w-full" />
            </label>
            <label className="text-[11px] font-semibold text-[#6B7280]">Solde initial
              <input type="number" value={form.soldeBancaireInitial} onChange={(e) => setForm({ ...form, soldeBancaireInitial: e.target.value })} className="input mt-1 w-full" />
            </label>
            <label className="text-[11px] font-semibold text-[#6B7280]">Solde final
              <input type="number" value={form.soldeBancaireFinal} onChange={(e) => setForm({ ...form, soldeBancaireFinal: e.target.value })} className="input mt-1 w-full" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => quickSelect("month")} className="btn btn-outline btn-sm">Ce mois</button>
              <button onClick={() => quickSelect("last")} className="btn btn-outline btn-sm">Mois dernier</button>
              <button onClick={() => quickSelect("quarter")} className="btn btn-outline btn-sm">Ce trimestre</button>
            </div>
            <button onClick={start} disabled={starting} className="btn btn-gold">
              {starting ? "Démarrage..." : "Démarrer le rapprochement →"}
            </button>
          </div>
        </section>

        {selected && (
          <>
            <section className="grid grid-cols-2 border-y border-[rgba(0,0,0,0.08)] bg-white md:grid-cols-4">
              <Metric label="Solde bancaire" value={mad(selected.solde_final_banque)} sub="selon votre relevé" />
              <Metric label="Solde comptable" value={mad(selected.solde_final_comptable)} sub="selon vos écritures" />
              <Metric label="Écart" value={mad(selected.ecart)} sub="doit être égal à 0" danger={Math.abs(Number(selected.ecart)) >= 0.01} />
              <Metric label="Lignes rapprochées" value={`${lineStats.matched} / ${lineStats.total}`} sub={`${lineStats.pct}%`} />
            </section>

            <div className={`flex flex-wrap items-center gap-3 border-l-[3px] px-4 py-2.5 text-[12px] font-semibold ${selected.is_balanced ? "border-l-[#059669] bg-[#F3FAF6] text-[#047857]" : "border-l-[#D97706] bg-[#FCF8F1] text-[#B45309]"}`}>
              <span>{selected.is_balanced ? "Rapprochement équilibré — prêt à valider" : `Écart de ${mad(selected.ecart)} — vérifiez les lignes en rouge`}</span>
              {selected.is_balanced && selected.statut !== "validé" && (
                <button onClick={() => postAction("validate")} className="btn btn-gold btn-sm">Valider le rapprochement</button>
              )}
            </div>

            <div className="ui-control flex items-center gap-1 bg-[#F3F4F6] p-1 md:hidden">
              <button onClick={() => setMobileTab("bank")}
                className={`flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${mobileTab === "bank" ? "bg-white text-[#1A1A2E] shadow-sm" : "text-[#6B7280] hover:text-[#1A1A2E]"}`}>
                Relevé bancaire
              </button>
              <button onClick={() => setMobileTab("entries")}
                className={`flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${mobileTab === "entries" ? "bg-white text-[#1A1A2E] shadow-sm" : "text-[#6B7280] hover:text-[#1A1A2E]"}`}>
                Écritures
              </button>
            </div>

            <section className="grid overflow-hidden border border-[rgba(0,0,0,0.08)] bg-white md:grid-cols-2">
              <Panel
                className={mobileTab === "entries" ? "hidden md:block" : ""}
                title="Relevé bancaire"
                meta={`${selected.periode_debut} → ${selected.periode_fin}`}
              >
                <Tabs items={["Toutes", "Non rapprochées", "Rapprochées", "Ignorées"]} active={filter} onChange={setFilter} />
                <div className="divide-y divide-[rgba(0,0,0,0.07)]">
                  {filteredLines.map((line) => {
                    const conf = confidenceLabel(Number(line.match_confidence ?? 0));
                    return (
                      <div key={line.id} className={`border-l-[3px] ${classForStatus(line.statut)} px-4 py-3.5`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11.5px] font-semibold text-[#6B7280]">{line.bank_date}</span>
                          <span className={`text-[13px] font-bold ${Number(line.bank_amount) >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>{mad(line.bank_amount)}</span>
                        </div>
                        <p className="mt-1.5 text-[13px] font-semibold text-[#1A1A2E]">{line.bank_description}</p>
                        {line.bank_reference && <p className="mt-0.5 text-[11px] text-[#9CA3AF]">Réf: {line.bank_reference}</p>}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className={`tag ${conf.className}`}>{conf.label}</span>
                          <span className="text-[11px] text-[#6B7280]">Statut: {line.statut}</span>
                        </div>
                        {line.statut === "en_attente" && line.ecriture_id && (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            <button onClick={() => postAction("match", { bankLineId: line.id, ecritureId: line.ecriture_id })} className="btn btn-gold btn-sm flex items-center gap-1"><Check size={13} /> Confirmer</button>
                            <button onClick={() => postAction("ignore", { bankLineId: line.id })} className="btn btn-outline btn-sm">Rejeter</button>
                          </div>
                        )}
                        {line.statut === "non_rapproché" && (
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            <button className="btn btn-outline btn-sm flex items-center gap-1"><Search size={13} /> Trouver une écriture</button>
                            <button onClick={() => postAction("ignore", { bankLineId: line.id })} className="btn btn-outline btn-sm flex items-center gap-1"><SkipForward size={13} /> Ignorer</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel
                className={mobileTab === "bank" ? "hidden md:block" : ""}
                title="Écritures comptables"
                meta="Banque · 5141"
              >
                <Tabs items={["Toutes", "Non rapprochées", "Rapprochées", "Suspens"]} active={entryFilter} onChange={setEntryFilter} />
                <div className="divide-y divide-[rgba(0,0,0,0.07)]">
                  {filteredEcritures.map((entry) => {
                    const matched = matchedEcritureIds.has(entry.id);
                    return (
                      <div key={entry.id} className={`px-4 py-3.5 ${matched ? "border-l-[3px] border-l-[#059669]" : "border-l-[3px] border-l-transparent"}`}>
                        <div className="flex items-center justify-between gap-3 text-[11.5px] font-semibold text-[#6B7280]">
                          <span>{entry.date_ecriture} · {entry.journal}</span>
                          <span>{mad(Number(entry.debit || 0) - Number(entry.credit || 0))}</span>
                        </div>
                        <p className="mt-1.5 text-[13px] font-semibold text-[#1A1A2E]">{entry.libelle || "Écriture bancaire"}</p>
                        <p className="mt-1 text-[11px] text-[#6B7280]">DÉBIT 5141: {mad(entry.debit)} · CRÉDIT 5141: {mad(entry.credit)}</p>
                        <p className="mt-2 text-[11px] font-semibold text-[#6B7280]">{matched ? "Rapproché" : "Non rapproché"}</p>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            </section>

            {lines.some((line) => line.statut === "non_rapproché") && (
              <section className="border-y border-[rgba(0,0,0,0.08)] bg-white">
                <div className="border-b border-[rgba(0,0,0,0.08)] px-4 py-3">
                  <h2 className="text-[13.5px] font-semibold text-[#1A1A2E]">Lignes bancaires sans écriture</h2>
                  <p className="mt-0.5 text-[11px] text-[#9CA3AF]">Créez uniquement les transactions réellement absentes de la comptabilité.</p>
                </div>
                <div className="divide-y divide-[rgba(0,0,0,0.07)]">
                  {lines.filter((line) => line.statut === "non_rapproché").map((line) => (
                    <div key={line.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                          <span className="font-semibold text-[#6B7280]">{line.bank_date}</span>
                          <span className="font-bold text-[#1A1A2E]">{mad(line.bank_amount)}</span>
                        </div>
                        <p className="mt-1 truncate text-[12.5px] text-[#374151]">{line.bank_description}</p>
                      </div>
                      <button onClick={() => postAction("create-transaction", { bankLineId: line.id, category: Number(line.bank_amount) < 0 ? "Télécom" : "Revenu", compte: "5141", description: line.bank_description })} className="btn btn-gold btn-sm flex flex-shrink-0 items-center gap-1.5">
                        <FilePlus2 size={13} /> Créer la transaction
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

      </div>
    </div>
  );
}

function Metric({ label, value, sub, danger = false }: { label: string; value: string; sub: string; danger?: boolean }) {
  return (
    <div className="min-w-0 border-b border-r border-[rgba(0,0,0,0.08)] px-4 py-3 last:border-r-0 md:border-b-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.5px] text-[#6B7280]">{label}</div>
      <div className={`mt-1 truncate text-[18px] font-bold leading-tight ${danger ? "text-[#DC2626]" : "text-[#1A1A2E]"}`} title={value}>{value}</div>
      <div className="mt-0.5 text-[10.5px] text-[#9CA3AF]">{sub}</div>
    </div>
  );
}

function Tabs({ items, active, onChange }: { items: string[]; active: string; onChange: (value: string) => void }) {
  return (
    <div role="tablist" className="flex items-center gap-4 overflow-x-auto border-b border-[rgba(0,0,0,0.07)] px-4">
      {items.map((item) => (
        <button key={item} role="tab" aria-selected={active === item} onClick={() => onChange(item)}
          className={`flex-shrink-0 whitespace-nowrap border-b-2 px-0.5 py-2.5 text-[11.5px] font-medium transition-colors ${
            active === item ? "border-[#C8924A] text-[#1A1A2E]" : "border-transparent text-[#6B7280] hover:text-[#1A1A2E]"
          }`}>
          {item}
        </button>
      ))}
    </div>
  );
}

function Panel({ title, meta, children, className = "" }: { title: string; meta: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 bg-white first:md:border-r first:md:border-[rgba(0,0,0,0.08)] ${className}`}>
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
        <h2 className="text-[13px] font-semibold text-[#1A1A2E]">{title}</h2>
        <span className="whitespace-nowrap text-[11px] font-medium text-[#9CA3AF]">{meta}</span>
      </div>
      {children}
    </div>
  );
}

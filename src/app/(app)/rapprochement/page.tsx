"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, Download, FilePlus2, GitMerge, Search, SkipForward } from "lucide-react";

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
  if (confidence >= 0.9) return { label: "Haute confiance", color: "bg-[#ECFDF5] text-[#047857]" };
  if (confidence >= 0.7) return { label: "À confirmer", color: "bg-[#FFF7ED] text-[#B45309]" };
  return { label: "Non rapproché", color: "bg-[#FEE2E2] text-[#B91C1C]" };
}

export default function RapprochementPage({ dossierId }: { dossierId?: string }) {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<Session[]>([]);
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
    setSessions(list);
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

  if (loading) return <div className="text-[13px] text-[#6B7280]">Chargement...</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#C8924A]/10 text-[#C8924A]">
            <GitMerge size={20} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#0D1526]">Rapprochement bancaire</h1>
            <p className="mt-1 text-[13px] text-[#6B7280]">Comparez vos mouvements bancaires avec vos écritures comptables.</p>
          </div>
        </div>
        {selected && (
          <a href={`/api/rapprochement/${selected.id}/report`} className="inline-flex items-center gap-2 rounded-md border border-[#C8924A] px-3 py-2 text-[12.5px] font-bold text-[#C8924A]">
            <Download size={14} /> Rapport PDF
          </a>
        )}
      </div>

      <section className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-white p-5">
        <h2 className="text-[15px] font-bold text-[#0D1526]">Nouveau rapprochement</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <label className="text-[12px] font-semibold text-[#374151]">Date début<input type="date" value={form.periodeDebut} onChange={(e) => setForm({ ...form, periodeDebut: e.target.value })} className="input mt-1 w-full" /></label>
          <label className="text-[12px] font-semibold text-[#374151]">Date fin<input type="date" value={form.periodeFin} onChange={(e) => setForm({ ...form, periodeFin: e.target.value })} className="input mt-1 w-full" /></label>
          <label className="text-[12px] font-semibold text-[#374151]">Solde initial<input type="number" value={form.soldeBancaireInitial} onChange={(e) => setForm({ ...form, soldeBancaireInitial: e.target.value })} className="input mt-1 w-full" /></label>
          <label className="text-[12px] font-semibold text-[#374151]">Solde final<input type="number" value={form.soldeBancaireFinal} onChange={(e) => setForm({ ...form, soldeBancaireFinal: e.target.value })} className="input mt-1 w-full" /></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={() => quickSelect("month")} className="btn btn-sm border-[#E7D3B5] bg-[#FAF3E8] text-[#9A6528] hover:border-[#C8924A] hover:bg-[#F5E8D5]">Ce mois</button>
            <button onClick={() => quickSelect("last")} className="btn btn-sm border-[#E7D3B5] bg-[#FAF3E8] text-[#9A6528] hover:border-[#C8924A] hover:bg-[#F5E8D5]">Mois dernier</button>
            <button onClick={() => quickSelect("quarter")} className="btn btn-sm border-[#E7D3B5] bg-[#FAF3E8] text-[#9A6528] hover:border-[#C8924A] hover:bg-[#F5E8D5]">Ce trimestre</button>
          </div>
          <button onClick={start} disabled={starting} className="rounded-md bg-[#C8924A] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60">
            {starting ? "Démarrage..." : "Démarrer le rapprochement →"}
          </button>
        </div>
        <p className="mt-2 text-[11.5px] text-[#9CA3AF]">Ces montants sont sur votre relevé bancaire.</p>
      </section>

      {selected && (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <Metric label="Solde bancaire" value={mad(selected.solde_final_banque)} sub="selon votre relevé" />
            <Metric label="Solde comptable" value={mad(selected.solde_final_comptable)} sub="selon vos écritures" />
            <Metric label="Écart" value={mad(selected.ecart)} sub="doit être égal à 0" danger={Math.abs(Number(selected.ecart)) >= 0.01} />
            <Metric label="Lignes rapprochées" value={`${lineStats.matched} / ${lineStats.total}`} sub={`${lineStats.pct}%`} />
          </section>

          <div className={`rounded-lg border px-4 py-3 text-[13px] font-semibold ${selected.is_balanced ? "border-[#BBF7D0] bg-[#ECFDF5] text-[#047857]" : "border-[#FED7AA] bg-[#FFF7ED] text-[#B45309]"}`}>
            {selected.is_balanced ? "Rapprochement équilibré — prêt à valider" : `Écart de ${mad(selected.ecart)} — vérifiez les lignes en rouge`}
            {selected.is_balanced && selected.statut !== "validé" && <button onClick={() => postAction("validate")} className="ml-3 rounded bg-[#C8924A] px-3 py-1.5 text-white">Valider le rapprochement</button>}
          </div>

          <div className="md:hidden flex rounded-lg bg-white p-1">
            <button onClick={() => setMobileTab("bank")} className={`flex-1 rounded-md py-2 text-[13px] font-bold ${mobileTab === "bank" ? "bg-[#0D1526] text-white" : "text-[#6B7280]"}`}>Relevé bancaire</button>
            <button onClick={() => setMobileTab("entries")} className={`flex-1 rounded-md py-2 text-[13px] font-bold ${mobileTab === "entries" ? "bg-[#0D1526] text-white" : "text-[#6B7280]"}`}>Écritures</button>
          </div>

          <section className="grid gap-0 overflow-hidden rounded-lg border border-[rgba(0,0,0,0.08)] md:grid-cols-2">
            <Panel className={mobileTab === "entries" ? "hidden md:block" : ""} title={`Mouvements bancaires — ${selected.periode_debut} → ${selected.periode_fin}`} sub="Lignes de votre relevé réel">
              <Tabs items={["Toutes", "Non rapprochées", "Rapprochées", "Ignorées"]} active={filter} onChange={setFilter} />
              <div className="mt-3 space-y-3">
                {filteredLines.map((line) => {
                  const conf = confidenceLabel(Number(line.match_confidence ?? 0));
                  return (
                    <div key={line.id} className={`border-l-4 ${classForStatus(line.statut)} rounded-md border-y border-r border-[rgba(0,0,0,0.08)] bg-white p-4`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[12px] font-semibold text-[#6B7280]">{line.bank_date}</span>
                        <span className={`font-bold ${Number(line.bank_amount) >= 0 ? "text-[#059669]" : "text-[#DC2626]"}`}>{mad(line.bank_amount)}</span>
                      </div>
                      <p className="mt-2 text-[13.5px] font-semibold text-[#0D1526]">{line.bank_description}</p>
                      {line.bank_reference && <p className="mt-1 text-[11.5px] text-[#9CA3AF]">Réf: {line.bank_reference}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${conf.color}`}>{conf.label}</span>
                        <span className="text-[11.5px] text-[#6B7280]">Statut: {line.statut}</span>
                      </div>
                      {line.statut === "en_attente" && line.ecriture_id && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={() => postAction("match", { bankLineId: line.id, ecritureId: line.ecriture_id })} className="btn btn-sm"><Check size={13} /> Confirmer</button>
                          <button onClick={() => postAction("ignore", { bankLineId: line.id })} className="btn btn-outline btn-sm">Rejeter</button>
                        </div>
                      )}
                      {line.statut === "non_rapproché" && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button className="btn btn-outline btn-sm"><Search size={13} /> Trouver une écriture</button>
                          <button onClick={() => postAction("ignore", { bankLineId: line.id })} className="btn btn-outline btn-sm"><SkipForward size={13} /> Ignorer</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel className={mobileTab === "bank" ? "hidden md:block" : ""} title="Écritures comptables — compte Banque (5141)" sub="Mouvements enregistrés dans vos livres" cream>
              <Tabs items={["Toutes", "Non rapprochées", "Rapprochées", "Suspens"]} active={entryFilter} onChange={setEntryFilter} />
              <div className="mt-3 space-y-3">
                {filteredEcritures.map((entry) => {
                  const matched = matchedEcritureIds.has(entry.id);
                  return (
                    <div key={entry.id} className={`rounded-md border border-[rgba(0,0,0,0.08)] bg-white p-4 ${matched ? "border-l-4 border-l-[#059669]" : ""}`}>
                      <div className="flex items-center justify-between gap-3 text-[12px] font-semibold text-[#6B7280]">
                        <span>{entry.date_ecriture} · {entry.journal}</span>
                        <span>{mad(Number(entry.debit || 0) - Number(entry.credit || 0))}</span>
                      </div>
                      <p className="mt-2 text-[13.5px] font-semibold text-[#0D1526]">{entry.libelle || "Écriture bancaire"}</p>
                      <p className="mt-1 text-[12px] text-[#6B7280]">DÉBIT 5141: {mad(entry.debit)} · CRÉDIT 5141: {mad(entry.credit)}</p>
                      <p className="mt-3 text-[11.5px] font-semibold text-[#6B7280]">{matched ? "Rapproché" : "Non rapproché"}</p>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </section>

          {lines.some((line) => line.statut === "non_rapproché") && (
            <section className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-white p-5">
              <h2 className="text-[15px] font-bold text-[#0D1526]">Lignes bancaires sans écriture</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {lines.filter((line) => line.statut === "non_rapproché").map((line) => (
                  <div key={line.id} className="rounded-md border border-[rgba(0,0,0,0.08)] p-4">
                    <div className="flex justify-between text-[13px] font-bold"><span>{line.bank_date}</span><span>{mad(line.bank_amount)}</span></div>
                    <p className="mt-2 text-[13px] text-[#374151]">{line.bank_description}</p>
                    <button onClick={() => postAction("create-transaction", { bankLineId: line.id, category: Number(line.bank_amount) < 0 ? "Télécom" : "Revenu", compte: "5141", description: line.bank_description })} className="mt-3 inline-flex items-center gap-2 rounded-md bg-[#C8924A] px-3 py-2 text-[12px] font-bold text-white">
                      <FilePlus2 size={14} /> Créer la transaction
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-bold text-[#0D1526]">Historique</h2>
          {sessions.length > 0 && (
            <select value={selected?.id ?? ""} onChange={(e) => setSelected(sessions.find((item) => item.id === e.target.value) ?? null)} className="input max-w-[260px] text-[12px]">
              {sessions.map((session) => <option key={session.id} value={session.id}>{session.periode_debut} → {session.periode_fin} · {session.statut}</option>)}
            </select>
          )}
        </div>
        {sessions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr><th>Période</th><th>Solde bancaire</th><th>Solde comptable</th><th>Écart</th><th>Statut</th><th>Validation</th></tr></thead>
              <tbody>{sessions.map((session) => (
                <tr key={session.id} className="cursor-pointer hover:bg-[#FAFAF6]" onClick={() => setSelected(session)}>
                  <td>{session.periode_debut} → {session.periode_fin}</td>
                  <td>{mad(session.solde_final_banque)}</td>
                  <td>{mad(session.solde_final_comptable)}</td>
                  <td className={Math.abs(Number(session.ecart)) < 0.01 ? "text-[#059669]" : "text-[#DC2626]"}>{mad(session.ecart)}</td>
                  <td>{session.statut}</td>
                  <td>{session.validated_at ? new Date(session.validated_at).toLocaleDateString("fr-FR") : "-"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-[rgba(0,0,0,0.12)] px-4 py-8 text-center text-[13px] text-[#6B7280]">
            Aucun rapprochement enregistré pour le moment.
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, sub, danger = false }: { label: string; value: string; sub: string; danger?: boolean }) {
  return (
    <div className="rounded-lg border border-[rgba(0,0,0,0.08)] bg-white p-4">
      <p className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">{label}</p>
      <p className={`mt-2 text-[20px] font-bold ${danger ? "text-[#DC2626]" : "text-[#0D1526]"}`}>{value}</p>
      <p className="mt-1 text-[11.5px] text-[#9CA3AF]">{sub}</p>
    </div>
  );
}

function Tabs({ items, active, onChange }: { items: string[]; active: string; onChange: (value: string) => void }) {
  return <div className="flex gap-2 overflow-x-auto">{items.map((item) => <button key={item} onClick={() => onChange(item)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11.5px] font-bold ${active === item ? "bg-[#0D1526] text-white" : "bg-[#FAFAF6] text-[#6B7280] border border-[rgba(0,0,0,0.16)] shadow-[0_1px_2px_rgba(13,21,38,0.05)] hover:bg-[#F0EDE5]"}`}>{item}</button>)}</div>;
}

function Panel({ title, sub, children, cream = false, className = "" }: { title: string; sub: string; children: React.ReactNode; cream?: boolean; className?: string }) {
  return (
    <div className={`${cream ? "bg-[#FAFAF6]" : "bg-white"} p-4 md:border-l md:border-[rgba(0,0,0,0.08)] ${className}`}>
      <h2 className="text-[15px] font-bold text-[#0D1526]">{title}</h2>
      <p className="mt-1 text-[12px] text-[#6B7280]">{sub}</p>
      {children}
    </div>
  );
}

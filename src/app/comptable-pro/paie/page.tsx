"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { UserRoundCog, FolderOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
                   "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}

interface DossierRow {
  id: string;
  raison_sociale: string;
  forme_juridique: string | null;
  cnss: string | null;
}

interface DossierStats {
  employes: number;
  masse: number;
  statut: "saisie" | "partielle" | "non_saisie";
}

export default function FiduciairePaiePage() {
  const supabase = createClient();
  const ownerId = useAccountOwnerId();
  const now = new Date();

  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [dossiers, setDossiers] = useState<DossierRow[]>([]);
  const [stats, setStats] = useState<Record<string, DossierStats>>({});
  const [loading, setLoading] = useState(true);

  function prev() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function next() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const { data: dos } = await supabase
      .from("dossiers")
      .select("id, raison_sociale, forme_juridique, cnss")
      .eq("fiduciaire_user_id", ownerId)
      .eq("statut", "actif")
      .order("raison_sociale");

    const dossierList: DossierRow[] = dos ?? [];
    setDossiers(dossierList);

    if (dossierList.length === 0) { setLoading(false); return; }

    const ids = dossierList.map(d => d.id);

    // Employee count per dossier
    const { data: empData } = await supabase
      .from("employees")
      .select("dossier_id")
      .in("dossier_id", ids)
      .eq("statut", "actif");

    // Bulletins for the selected month/year per dossier
    const { data: bulData } = await supabase
      .from("bulletins_paie")
      .select("dossier_id, salaire_brut, statut")
      .in("dossier_id", ids)
      .eq("mois", month)
      .eq("annee", year);

    const map: Record<string, DossierStats> = {};
    for (const d of dossierList) {
      const employes = (empData ?? []).filter((e: any) => e.dossier_id === d.id).length;
      const buls = (bulData ?? []).filter((b: any) => b.dossier_id === d.id);
      const masse = buls.reduce((s: number, b: any) => s + Number(b.salaire_brut), 0);
      const validated = buls.filter((b: any) => b.statut === "validé" || b.statut === "payé").length;
      const statut: DossierStats["statut"] =
        buls.length === 0 ? "non_saisie"
        : validated === buls.length ? "saisie"
        : "partielle";
      map[d.id] = { employes, masse, statut };
    }
    setStats(map);
    setLoading(false);
  }, [month, ownerId, year]);

  useEffect(() => { load(); }, [load]);

  const monthLabel = MONTHS_FR[month - 1];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-[rgba(200,146,74,0.12)] flex items-center justify-center flex-shrink-0">
            <UserRoundCog size={18} className="text-[#C8924A]" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Bulletins de paie</h1>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">Masse salariale consolidée par dossier</p>
          </div>
        </div>

        {/* Month navigator */}
        <div className="flex items-center gap-2">
          <button onClick={prev}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.10)] bg-white hover:border-[#C8924A] transition-colors">
            <ChevronLeft size={15} />
          </button>
          <span className="text-[14px] font-semibold text-[#1A1A2E] min-w-[140px] text-center select-none">
            {monthLabel} {year}
          </span>
          <button onClick={next}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[rgba(0,0,0,0.10)] bg-white hover:border-[#C8924A] transition-colors">
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-[13px] text-[#9CA3AF]">Chargement...</div>
      ) : dossiers.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen size={36} className="text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-[13px] text-[#6B7280] mb-1">Aucun dossier actif</p>
          <Link href="/comptable-pro/dossiers/new" className="btn btn-gold btn-sm mt-3 inline-flex">
            Créer un dossier
          </Link>
        </div>
      ) : (
        <div className="tbl">
          <div className="tbl-header">
            <span className="tbl-title">Dossiers — Paie {monthLabel} {year}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>CNSS</th>
                <th className="text-center">Employés</th>
                <th className="text-right">Masse salariale</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map(d => {
                const s = stats[d.id];
                return (
                  <tr key={d.id}>
                    <td className="font-medium">
                      {d.raison_sociale}
                      {d.forme_juridique && (
                        <span className="ml-1.5 text-[11px] text-[#9CA3AF]">{d.forme_juridique}</span>
                      )}
                    </td>
                    <td className="text-[12px] text-[#6B7280]">{d.cnss || "—"}</td>
                    <td className="text-center text-[12.5px] font-semibold text-[#1A1A2E]">
                      {s ? s.employes || "—" : "—"}
                    </td>
                    <td className="text-right text-[12.5px] font-semibold text-[#1A1A2E]">
                      {s && s.masse > 0 ? fmt(s.masse) : "—"}
                    </td>
                    <td>
                      {!s || s.statut === "non_saisie" ? (
                        <span className="tag tag-gray">Non saisie</span>
                      ) : s.statut === "partielle" ? (
                        <span className="tag tag-warn">Partielle</span>
                      ) : (
                        <span className="tag tag-green">Validée</span>
                      )}
                    </td>
                    <td>
                      <Link
                        href={`/comptable-pro/dossiers/${d.id}/paie`}
                        className="btn btn-outline btn-sm">
                        Ouvrir →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

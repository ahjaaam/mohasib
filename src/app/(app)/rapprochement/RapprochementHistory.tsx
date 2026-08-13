"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, History } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Session = {
  id: string;
  periode_debut: string;
  periode_fin: string;
  solde_final_banque: number;
  solde_final_comptable: number;
  ecart: number;
  statut: string;
  validated_at: string | null;
};

function mad(value: number) {
  return `${Number(value || 0).toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}

export default function RapprochementHistory({ dossierId }: { dossierId?: string }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const baseHref = dossierId ? `/comptable-pro/dossiers/${dossierId}/rapprochement` : "/rapprochement";

  useEffect(() => {
    let active = true;

    async function load() {
      const supabase = createClient();
      const query = supabase.from("rapprochement_sessions").select("id, periode_debut, periode_fin, solde_final_banque, solde_final_comptable, ecart, statut, validated_at").order("created_at", { ascending: false });
      const { data } = await (dossierId ? query.eq("dossier_id", dossierId) : query.is("dossier_id", null));
      if (!active) return;
      setSessions((data ?? []) as Session[]);
      setLoading(false);
    }

    void load();
    return () => { active = false; };
  }, [dossierId]);

  return (
    <div>
      <div className="mb-5 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center bg-[rgba(200,146,74,0.12)] text-[#C8924A]">
            <History size={18} />
          </div>
          <div>
            <h1 className="text-[18px] font-bold leading-none text-[#1A1A2E]">Historique des rapprochements</h1>
            <p className="mt-0.5 text-[11px] text-[#9CA3AF]">Consultez les périodes précédentes et leurs écarts.</p>
          </div>
        </div>
        <Link href={baseHref} className="btn btn-outline btn-sm flex items-center gap-1.5">
          <ArrowLeft size={13} /> Retour au rapprochement
        </Link>
      </div>

      {loading ? (
        <div className="loading-state">Chargement de l’historique…</div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">Aucun rapprochement enregistré.</div>
      ) : (
        <div className="tbl">
          <div className="overflow-x-auto">
            <table className="min-w-[760px]">
              <thead>
                <tr>
                  <th>Période</th>
                  <th>Solde bancaire</th>
                  <th>Solde comptable</th>
                  <th>Écart</th>
                  <th>Statut</th>
                  <th>Validation</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <Link href={`${baseHref}?session=${session.id}`} className="font-semibold text-[#1A1A2E] hover:text-[#C8924A]">
                        {session.periode_debut} → {session.periode_fin}
                      </Link>
                    </td>
                    <td>{mad(session.solde_final_banque)}</td>
                    <td>{mad(session.solde_final_comptable)}</td>
                    <td className={Math.abs(Number(session.ecart)) < 0.01 ? "font-semibold text-[#059669]" : "font-semibold text-[#DC2626]"}>{mad(session.ecart)}</td>
                    <td>{session.statut}</td>
                    <td>{session.validated_at ? new Date(session.validated_at).toLocaleDateString("fr-MA") : "—"}</td>
                    <td className="text-right">
                      <a href={`/api/rapprochement/${session.id}/report`} className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[#6B7280] hover:text-[#C8924A]">
                        <Download size={12} /> PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

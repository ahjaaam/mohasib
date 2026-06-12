export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { FolderOpen, Plus, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { Dossier } from "@/types/fiduciaire";
import { resolveAccountOwnerId } from "@/lib/account-owner";

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function StatusDot({ derniere_ecriture }: { derniere_ecriture: string | null }) {
  const days = daysSince(derniere_ecriture);
  if (days <= 7)  return <CheckCircle2 size={16} className="flex-shrink-0 text-[#059669]" />;
  if (days <= 30) return <Clock        size={16} className="flex-shrink-0 text-[#D97706]" />;
  return               <AlertCircle   size={16} className="flex-shrink-0 text-[#DC2626]" />;
}

export default async function DossiersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; statut?: string }>;
}) {
  const { q, statut } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const ownerId = await resolveAccountOwnerId(user!.id);

  let query = supabase.from("dossiers").select("*").eq("fiduciaire_user_id", ownerId).order("raison_sociale");
  if (statut === "actif" || statut === "inactif") query = query.eq("statut", statut);

  const { data } = await query;
  let dossiers: Dossier[] = data ?? [];

  if (q) {
    const lq = q.toLowerCase();
    dossiers = dossiers.filter(d =>
      d.raison_sociale.toLowerCase().includes(lq) ||
      (d.ice ?? "").toLowerCase().includes(lq)
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-7">
        <div className="w-11 h-11 rounded-xl bg-[rgba(200,146,74,0.12)] flex items-center justify-center flex-shrink-0">
          <FolderOpen size={20} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[20px] font-bold text-[#1A1A2E] leading-tight">Dossiers clients</h1>
          <p className="text-[12.5px] text-[#6B7280]">
            {dossiers.length} dossier{dossiers.length !== 1 ? "s" : ""}
            {q ? ` · Résultats pour "${q}"` : ""}
          </p>
        </div>
        <div className="ml-auto">
          <Link href="/comptable-pro/dossiers/new" className="btn btn-gold">
            <Plus size={13} /> Nouveau dossier
          </Link>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex items-center gap-2 mb-6">
        <input
          name="q"
          defaultValue={q}
          placeholder="Rechercher par nom ou ICE..."
          className="input max-w-[280px]"
        />
        <div className="flex items-center gap-1 bg-[#F3F4F6] p-1 rounded-xl">
          {[
            { value: "", label: "Tous" },
            { value: "actif", label: "Actifs" },
            { value: "inactif", label: "Inactifs" },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="submit"
              name="statut"
              value={value}
              className={`px-3 py-1 rounded-lg text-[12px] font-medium transition-all ${
                (statut ?? "") === value
                  ? "bg-white text-[#1A1A2E] shadow-sm"
                  : "text-[#6B7280] hover:text-[#1A1A2E]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </form>

      {/* Grid */}
      {dossiers.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen size={36} className="text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-[13px] text-[#6B7280] mb-1">
            {q ? `Aucun dossier pour "${q}"` : "Aucun dossier client"}
          </p>
          {!q && (
            <Link href="/comptable-pro/dossiers/new" className="btn btn-gold btn-sm mt-3 inline-flex">
              <Plus size={12} /> Créer un dossier
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dossiers.map((d) => (
            <Link key={d.id} href={`/comptable-pro/dossiers/${d.id}`}
              className="card p-4 hover:border-[#C8924A] hover:shadow-[0_2px_12px_rgba(200,146,74,0.12)] transition-all group block">
              <div className="flex items-start gap-2 mb-3">
                <StatusDot derniere_ecriture={d.derniere_ecriture} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-[#1A1A2E] truncate group-hover:text-[#C8924A] transition-colors">
                    {d.raison_sociale}
                  </div>
                  <div className="text-[11.5px] text-[#6B7280]">
                    {d.forme_juridique}{d.ice ? ` · ICE: ${d.ice}` : ""}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 text-[12px] text-[#6B7280] mb-3">
                <div className="flex justify-between">
                  <span>Régime TVA</span>
                  <span className="capitalize font-medium text-[#1A1A2E]">{d.regime_tva}</span>
                </div>
                <div className="flex justify-between">
                  <span>Exercice</span>
                  <span className="font-medium text-[#1A1A2E]">
                    {d.date_debut_exercice
                      ? new Date(d.date_debut_exercice).toLocaleDateString("fr-MA", { month: "short", year: "numeric" })
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Dernière écriture</span>
                  <span className="font-medium text-[#1A1A2E]">
                    {d.derniere_ecriture
                      ? new Date(d.derniere_ecriture).toLocaleDateString("fr-MA", { day: "numeric", month: "short" })
                      : "Aucune"}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[rgba(0,0,0,0.06)]">
                <span className={`text-[10.5px] font-medium px-2 py-0.5 rounded-full ${
                  d.statut === "actif" ? "bg-[#D1FAE5] text-[#065F46]" : "bg-[#F3F4F6] text-[#6B7280]"
                }`}>
                  {d.statut === "actif" ? "Actif" : "Inactif"}
                </span>
                <span className="text-[11.5px] text-[#C8924A] font-medium group-hover:underline">
                  Ouvrir le dossier →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

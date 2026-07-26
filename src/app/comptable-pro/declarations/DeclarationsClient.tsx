"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Receipt, ChevronLeft, ChevronRight, Download, Check, AlertCircle, ExternalLink } from "lucide-react";
import type { DossierTva } from "@/types/fiduciaire";

const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2 }) + " MAD";
}

interface DossierRow {
  id: string;
  raison_sociale: string;
  forme_juridique: string | null;
  regime_tva: string | null;
  statut: string;
  ice: string | null;
  if_fiscal: string | null;
}

interface Props {
  dossiers: DossierRow[];
  tvaDecls: DossierTva[];
  year: number;
  month: number;
}

export default function DeclarationsClient({ dossiers, tvaDecls, year, month }: Props) {
  const router = useRouter();
  const periode = `${year}-${String(month).padStart(2, "0")}`;

  function navigate(dm: number) {
    let m = month + dm, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    router.push(`/comptable-pro/declarations?year=${y}&month=${m}`);
  }

  function getDeclForDossier(dossierId: string) {
    return tvaDecls.find(t => t.dossier_id === dossierId);
  }

  async function downloadZip(d: DossierRow) {
    const decl = getDeclForDossier(d.id);
    if (!decl) return;

    try {
      const JSZip = (await import("jszip")).default;
      const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      const n2  = (n: number) => n.toFixed(2);
      const [y, m] = decl.periode.split("-");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DeclarationTVA xmlns="http://www.tax.gov.ma/tva/2024" version="1.0">
  <Identification>
    <IF>${esc(d.if_fiscal ?? "")}</IF>
    <ICE>${esc(d.ice ?? "")}</ICE>
    <RaisonSociale>${esc(d.raison_sociale)}</RaisonSociale>
    <Periode>
      <Annee>${y}</Annee><Mois>${m}</Mois>
      <Regime>${d.regime_tva ?? "mensuel"}</Regime>
      <PeriodeDebut>${decl.periode}-01</PeriodeDebut>
      <PeriodeFin>${decl.periode}-${new Date(parseInt(y), parseInt(m), 0).getDate()}</PeriodeFin>
    </Periode>
  </Identification>
  <TVANette>
    <TVAExigibleTotal>${n2(decl.tva_collectee)}</TVAExigibleTotal>
    <TVADeductibleTotal>${n2(decl.tva_deductible)}</TVADeductibleTotal>
    <TVANetteDue>${n2(Math.max(decl.net_du, 0))}</TVANetteDue>
    <CreditTVA>${n2(Math.max(-decl.net_du, 0))}</CreditTVA>
  </TVANette>
</DeclarationTVA>`;

      const zip  = new JSZip();
      zip.file("declaration.xml", xml);
      const blob = await zip.generateAsync({ type: "blob" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `TVA_${d.if_fiscal || d.raison_sociale.replace(/\s+/g,"_")}_${decl.periode}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Erreur lors de la génération du fichier ZIP");
    }
  }

  const taxable    = dossiers.filter(d => d.regime_tva !== "exonere");
  const totalCollectee  = tvaDecls.reduce((s, t) => s + t.tva_collectee,  0);
  const totalDeductible = tvaDecls.reduce((s, t) => s + t.tva_deductible, 0);
  const totalNet        = tvaDecls.reduce((s, t) => s + t.net_du,         0);
  const aDeposer        = tvaDecls.filter(t => t.statut === "a_deposer").length;

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 bg-[rgba(200,146,74,0.12)] flex items-center justify-center flex-shrink-0">
          <Receipt size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Déclarations TVA</h1>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Toutes les déclarations · {MONTHS_FR[month - 1]} {year}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="btn btn-outline btn-sm p-1.5"><ChevronLeft size={15} /></button>
          <span className="text-[13px] font-semibold text-[#1A1A2E] min-w-[120px] text-center">
            {MONTHS_FR[month - 1]} {year}
          </span>
          <button onClick={() => navigate(1)} className="btn btn-outline btn-sm p-1.5"><ChevronRight size={15} /></button>
        </div>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
        <div className="kpi">
          <div className="kpi-label">Dossiers TVA</div>
          <div className="kpi-value">{taxable.length}</div>
          <div className="text-[11px] text-[#6B7280]">{dossiers.length} au total</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">À déposer</div>
          <div className="kpi-value" style={{ color: aDeposer > 0 ? "#D97706" : "#059669" }}>{aDeposer}</div>
          <div className="text-[11px] text-[#6B7280]">Échéance: 20 {MONTHS_FR[month % 12].slice(0, 4)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">TVA collectée</div>
          <div className="kpi-value text-[18px]">{fmt(totalCollectee)}</div>
          <div className="text-[11px] text-[#6B7280]">Déductible: {fmt(totalDeductible)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Net dû total</div>
          <div className="kpi-value text-[18px]" style={{ color: "#DC2626" }}>{fmt(totalNet)}</div>
          <div className="text-[11px] text-[#6B7280]">À verser à la DGI</div>
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="tbl">
        <div className="tbl-header">
          <span className="tbl-title">Détail par client — {periode}</span>
        </div>

        {dossiers.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-[#9CA3AF]">Aucun dossier actif</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Régime</th>
                <th className="text-right">TVA collectée</th>
                <th className="text-right">TVA déductible</th>
                <th className="text-right">Net dû</th>
                <th>Statut</th>
                <th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dossiers.map(d => {
                const decl = getDeclForDossier(d.id);
                const exonere = d.regime_tva === "exonere";

                return (
                  <tr key={d.id}>
                    <td className="font-medium">
                      {d.raison_sociale}
                      {d.forme_juridique && (
                        <span className="ml-1.5 text-[11px] text-[#9CA3AF]">{d.forme_juridique}</span>
                      )}
                    </td>

                    <td>
                      <span className="capitalize text-[12px]">{d.regime_tva ?? "—"}</span>
                    </td>

                    <td className="text-right text-[12.5px]">
                      {exonere ? <span className="text-[#9CA3AF]">—</span> : decl ? fmt(decl.tva_collectee) : <span className="text-[#9CA3AF]">—</span>}
                    </td>

                    <td className="text-right text-[12.5px]">
                      {exonere ? <span className="text-[#9CA3AF]">—</span> : decl ? fmt(decl.tva_deductible) : <span className="text-[#9CA3AF]">—</span>}
                    </td>

                    <td className="text-right">
                      {exonere ? (
                        <span className="text-[#9CA3AF] text-[12px]">Exonéré</span>
                      ) : decl ? (
                        <span className={`font-semibold text-[12.5px] ${decl.net_du > 0 ? "text-[#DC2626]" : "text-[#059669]"}`}>
                          {fmt(decl.net_du)}
                        </span>
                      ) : (
                        <span className="text-[#9CA3AF] text-[12px]">—</span>
                      )}
                    </td>

                    <td>
                      {exonere ? (
                        <span className="tag tag-gray !rounded-none">Exonéré</span>
                      ) : decl ? (
                        decl.statut === "deposee"
                          ? <span className="tag !rounded-none" style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}><Check size={10} className="inline mr-0.5" />Déposée</span>
                          : <span className="tag tag-warn !rounded-none"><AlertCircle size={10} className="inline mr-0.5" />À déposer</span>
                      ) : (
                        <span className="text-[11.5px] text-[#9CA3AF]">Non saisie</span>
                      )}
                    </td>

                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {decl && (
                          <button
                            onClick={() => downloadZip(d)}
                            title="Télécharger EDI ZIP"
                            className="btn btn-outline btn-sm flex items-center gap-1"
                          >
                            <Download size={11} /> ZIP
                          </button>
                        )}
                        <Link
                          href={`/comptable-pro/dossiers/${d.id}/tva`}
                          title="Voir les détails"
                          className="btn btn-outline btn-sm flex items-center gap-1"
                        >
                          <ExternalLink size={11} /> Détails
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: "#F0EDE5" }}>
                <td colSpan={2} className="font-semibold text-[12.5px]">Totaux</td>
                <td className="text-right font-semibold text-[12.5px]">{fmt(totalCollectee)}</td>
                <td className="text-right font-semibold text-[12.5px]">{fmt(totalDeductible)}</td>
                <td className="text-right font-bold text-[#DC2626] text-[12.5px]">{fmt(totalNet)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

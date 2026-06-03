"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, Check, ChevronDown, FileText, Loader2, Save } from "lucide-react";
import { getTVAConfig, saveTVAConfig } from "@/app/actions/tva-config";
import { DEFAULT_ENABLED_CODES, TVA_LINES, TVA_PRESETS, withAlwaysShown, type TVASection } from "@/lib/tva-lines-registry";

interface Props {
  companyId: string | null;
}

const SECTION_LABELS: Record<TVASection, string> = {
  A: "Ventilation du CA total",
  B: "CA imposable par taux",
  C: "Non-résidents",
  D: "Retenues et reversements",
  E: "Déductions",
};

function monthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function TVAConfigTab({ companyId }: Props) {
  const [scope, setScope] = useState<"global" | "period">("global");
  const [period, setPeriod] = useState(monthValue());
  const [enabled, setEnabled] = useState<Set<number>>(() => withAlwaysShown(DEFAULT_ENABLED_CODES));
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState(false);
  const [openSections, setOpenSections] = useState<Record<TVASection, boolean>>({
    A: true,
    B: true,
    C: false,
    D: false,
    E: true,
  });

  const activePeriod = scope === "period" ? period : null;

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!companyId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const config = await getTVAConfig(companyId, activePeriod);
      if (!alive) return;
      setEnabled(withAlwaysShown(config.enabledCodes));
      setLocked(config.locked);
      setLoading(false);
    }
    load();
    return () => { alive = false; };
  }, [companyId, activePeriod]);

  const grouped = useMemo(() => {
    const result = new Map<TVASection, Map<string, typeof TVA_LINES>>();
    for (const line of TVA_LINES) {
      if (!result.has(line.section)) result.set(line.section, new Map());
      const section = result.get(line.section)!;
      if (!section.has(line.subsection)) section.set(line.subsection, []);
      section.get(line.subsection)!.push(line);
    }
    return result;
  }, []);

  function toggleLine(code: number) {
    const line = TVA_LINES.find((item) => item.code === code);
    if (line?.always_shown) return;
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return withAlwaysShown(next);
    });
  }

  function applyPreset(label: string, codes: number[]) {
    setActivePreset(label);
    setEnabled(withAlwaysShown(codes));
  }

  async function handleSave() {
    if (!companyId) {
      toast.error("Entreprise introuvable");
      return;
    }
    setSaving(true);
    const res = await saveTVAConfig(companyId, Array.from(enabled), activePeriod);
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Configuration TVA enregistrée");
  }

  if (!companyId) {
    return (
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <p className="text-[13px] text-[#6B7280]">Créez d'abord les informations de l'entreprise pour configurer la déclaration TVA.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[rgba(0,0,0,0.06)] flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(200,146,74,0.12)" }}>
          <FileText size={16} className="text-[#C8924A]" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-[#1A1A2E] leading-none">Déclaration TVA - Lignes actives</h2>
          <p className="text-[11px] text-[#9CA3AF] mt-1">Choisissez les lignes CGI visibles et incluses dans les calculs.</p>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div className="flex flex-wrap gap-3 items-center">
          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12.5px] cursor-pointer ${scope === "global" ? "border-[#C8924A] bg-[#FFF7ED] text-[#92400E]" : "border-[rgba(0,0,0,0.08)] text-[#6B7280]"}`}>
            <input type="radio" checked={scope === "global"} onChange={() => setScope("global")} />
            Appliquer à toutes les périodes futures
          </label>
          <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12.5px] cursor-pointer ${scope === "period" ? "border-[#C8924A] bg-[#FFF7ED] text-[#92400E]" : "border-[rgba(0,0,0,0.08)] text-[#6B7280]"}`}>
            <input type="radio" checked={scope === "period"} onChange={() => setScope("period")} />
            Configurer une période
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={scope !== "period"}
              className="input py-1 text-[12px] w-[132px]"
            />
          </label>
        </div>

        {locked && (
          <div className="flex items-start gap-2 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#92400E]">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            Cette période est verrouillée. La configuration sera ignorée pour cette déclaration.
          </div>
        )}

        <div>
          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-2">Préréglages rapides</p>
          <div className="flex flex-wrap gap-3">
            {TVA_PRESETS.map((preset) => (
              <label key={preset.label}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-[12.5px] cursor-pointer transition-all ${
                  activePreset === preset.label
                    ? "border-[#C8924A] bg-[#FFF7ED] text-[#92400E]"
                    : "border-[rgba(0,0,0,0.08)] text-[#6B7280] hover:text-[#1A1A2E] hover:bg-[#FAFAF6]"
                }`}>
                <input
                  type="radio"
                  name="tva-preset"
                  checked={activePreset === preset.label}
                  onChange={() => applyPreset(preset.label, preset.codes)}
                />
                {preset.label}
              </label>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-[12px] text-[#9CA3AF] py-10 justify-center">
            <Loader2 size={14} className="animate-spin" /> Chargement...
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(grouped.entries()).map(([section, subsections]) => {
              const lines = TVA_LINES.filter((line) => line.section === section);
              const selected = lines.filter((line) => enabled.has(line.code)).length;
              const open = openSections[section];
              return (
                <div key={section} className="border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-[#FAFAF6] text-left"
                  >
                    <div>
                      <p className="text-[12.5px] font-bold text-[#1A1A2E]">Section {section} - {SECTION_LABELS[section]}</p>
                      <p className="text-[11px] text-[#9CA3AF] mt-0.5">{selected}/{lines.length} lignes actives</p>
                    </div>
                    <ChevronDown size={15} className={`text-[#9CA3AF] transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>

                  {open && (
                    <div className="divide-y divide-[rgba(0,0,0,0.05)]">
                      {Array.from(subsections.entries()).map(([subsection, subsectionLines]) => (
                        <div key={subsection} className="p-4">
                          <p className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-[0.5px] mb-2">{subsection}</p>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                            {subsectionLines.map((line) => {
                              const checked = enabled.has(line.code);
                              return (
                                <label key={line.code}
                                  className={`flex items-start gap-2.5 rounded-lg px-3 py-2 border text-[12px] ${
                                    line.always_shown
                                      ? "bg-[#F3F4F6] border-[rgba(0,0,0,0.06)] text-[#6B7280]"
                                      : checked
                                        ? "bg-[#FFF7ED] border-[rgba(200,146,74,0.35)] text-[#1A1A2E]"
                                        : "bg-white border-[rgba(0,0,0,0.06)] text-[#6B7280]"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    disabled={line.always_shown}
                                    onClick={() => toggleLine(line.code)}
                                    className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                                      checked ? "bg-[#C8924A] border-[#C8924A] text-white" : "border-[#D1D5DB]"
                                    } disabled:opacity-70`}
                                  >
                                    {checked && <Check size={11} />}
                                  </button>
                                  <span><strong>{line.code}</strong> - {line.label_fr}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={() => companyId && getTVAConfig(companyId, activePeriod).then((config) => setEnabled(withAlwaysShown(config.enabledCodes)))}
            className="btn btn-outline text-[12px]">
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            className="btn btn-gold text-[12px] flex items-center gap-1.5">
            <Save size={13} /> {saving ? "Enregistrement..." : "Enregistrer la config"}
          </button>
        </div>
      </div>
    </div>
  );
}

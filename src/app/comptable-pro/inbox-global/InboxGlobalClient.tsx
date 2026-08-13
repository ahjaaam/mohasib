"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Inbox, Paperclip, Clock, CheckCircle2, XCircle, Sparkles, ChevronDown } from "lucide-react";
import { useAccountOwnerId } from "@/hooks/useAccountOwner";

interface GlobalItem {
  id: string;
  email_from: string | null;
  email_subject: string | null;
  email_body: string | null;
  received_at: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  ai_suggested_dossier: { id: string; raison_sociale: string } | null;
  ai_confidence: number | null;
  ai_reasoning: string | null;
  assigned_dossier: { id: string; raison_sociale: string } | null;
  status: string;
}

interface Props {
  items: GlobalItem[];
  dossiers: { id: string; raison_sociale: string }[];
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return `il y a ${Math.floor(diff / 60000)}min`;
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

function ConfidencePct({ v }: { v: number | null }) {
  if (v == null) return null;
  const pct = Math.round(v * 100);
  const color = pct >= 80 ? "#059669" : pct >= 60 ? "#D97706" : "#6B7280";
  return <span style={{ color }} className="font-semibold">{pct}%</span>;
}

export default function InboxGlobalClient({ items: initial, dossiers }: Props) {
  const [items, setItems] = useState<GlobalItem[]>(initial);
  const [selectedDossier, setSelectedDossier] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [tab, setTab] = useState<"unassigned" | "assigned" | "ignored">("unassigned");
  const [learnPrompt, setLearnPrompt] = useState<{ itemId: string; from: string; dossierName: string; dossierId: string } | null>(null);
  const supabase = createClient();
  const ownerId = useAccountOwnerId();

  const filtered = items.filter(i => i.status === tab);
  const unassignedCount = items.filter(i => i.status === "unassigned").length;

  async function assign(item: GlobalItem, dossierId: string, dossierName: string) {
    setSaving(item.id);
    // 1. Create receipt in the dossier inbox
    await supabase.from("receipts").insert({
      user_id: ownerId,
      dossier_id: dossierId,
      status: "pending",
      source: "email",
      storage_path: item.file_url ?? null,
      ocr_data: {
        email_from: item.email_from,
        email_subject: item.email_subject,
        routing_method: "manual",
      },
    });
    // 2. Mark global inbox item as assigned
    await supabase
      .from("inbox_global")
      .update({ status: "assigned", assigned_dossier_id: dossierId, assigned_at: new Date().toISOString() })
      .eq("id", item.id);

    setItems(prev => prev.map(i => i.id === item.id
      ? { ...i, status: "assigned", assigned_dossier: { id: dossierId, raison_sociale: dossierName } }
      : i,
    ));
    setSaving(null);
    toast.success(`Assigné à ${dossierName}`);

    // Offer to create routing rule for the sender
    if (item.email_from) {
      setLearnPrompt({ itemId: item.id, from: item.email_from, dossierName, dossierId });
    }
  }

  async function ignore(itemId: string) {
    await supabase.from("inbox_global").update({ status: "ignored" }).eq("id", itemId);
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: "ignored" } : i));
  }

  async function saveRoutingRule(from: string, dossierId: string) {
    // If the address looks like domain-only, create a domain rule; otherwise exact sender
    const isDomain = from.startsWith("@");
    await supabase.from("email_routing_rules").insert({
      fiduciaire_user_id: ownerId,
      dossier_id: dossierId,
      rule_type: isDomain ? "sender_domain" : "sender_email",
      rule_value: from,
      is_active: true,
    });
    toast.success("Règle créée — prochains emails routés automatiquement");
    setLearnPrompt(null);
  }

  const TabBtn = ({ value, label, count }: { value: typeof tab; label: string; count?: number }) => (
    <button
      onClick={() => setTab(value)}
      className={`tab flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap ${tab === value ? "active" : ""}`}
    >
      {label}
      {count != null && count > 0 && (
        <span className="bg-[#D97706] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{count}</span>
      )}
    </button>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 bg-[rgba(200,146,74,0.12)] flex items-center justify-center flex-shrink-0">
          <Inbox size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Achats — vue globale</h1>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Emails reçus non assignés automatiquement</p>
        </div>
        {unassignedCount > 0 && (
          <div className="ml-auto bg-[#FEF3C7] border border-[#FCD34D] rounded-xl px-3 py-2 text-[12.5px] font-semibold text-[#D97706]">
            {unassignedCount} en attente
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="tabs mb-5 overflow-x-auto">
        <TabBtn value="unassigned" label="À assigner" count={unassignedCount} />
        <TabBtn value="assigned"   label="Assignés" />
        <TabBtn value="ignored"    label="Ignorés" />
      </div>

      {/* Auto-learn prompt */}
      {learnPrompt && (
        <div className="mb-4 card p-4 border-[#FCD34D] bg-[#FFFBEB] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles size={15} className="text-[#D97706] flex-shrink-0" />
            <span className="text-[12.5px] text-[#1A1A2E]">
              Toujours assigner <strong>{learnPrompt.from}</strong> à <strong>{learnPrompt.dossierName}</strong> ?
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => saveRoutingRule(learnPrompt.from, learnPrompt.dossierId)}
              className="btn btn-gold btn-sm"
            >
              Créer la règle
            </button>
            <button onClick={() => setLearnPrompt(null)} className="btn btn-outline btn-sm">
              Non merci
            </button>
          </div>
        </div>
      )}

      {/* Email cards */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <CheckCircle2 size={32} className="text-[#D1D5DB] mx-auto mb-3" />
          <p className="text-[13px] text-[#6B7280]">
            {tab === "unassigned" ? "Aucun email en attente d'assignation" :
             tab === "assigned"   ? "Aucun email assigné" : "Aucun email ignoré"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(item => {
            const selected = selectedDossier[item.id] ?? item.ai_suggested_dossier?.id ?? "";
            const selectedName = dossiers.find(d => d.id === selected)?.raison_sociale ?? "";
            return (
              <div key={item.id} className="card p-4">
                {/* Email info */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-semibold text-[#1A1A2E] truncate">
                        {item.email_from ?? "—"}
                      </span>
                      {item.file_name && (
                        <span className="flex items-center gap-1 text-[11px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded flex-shrink-0">
                          <Paperclip size={10} /> {item.file_name}
                        </span>
                      )}
                    </div>
                    <div className="text-[12.5px] text-[#374151]">{item.email_subject ?? "(sans objet)"}</div>
                  </div>
                  <div className="flex items-center gap-1 text-[11.5px] text-[#9CA3AF] flex-shrink-0">
                    <Clock size={12} />
                    {timeAgo(item.received_at)}
                  </div>
                </div>

                {/* AI suggestion */}
                {item.ai_suggested_dossier && item.status === "unassigned" && (
                  <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-[#F0F9FF] border border-[#BAE6FD]">
                    <Sparkles size={13} className="text-[#0284C7] flex-shrink-0" />
                    <span className="text-[12px] text-[#0369A1]">
                      IA suggère: <strong>{item.ai_suggested_dossier.raison_sociale}</strong>
                      {" "}(confiance: <ConfidencePct v={item.ai_confidence} />)
                    </span>
                    {item.ai_reasoning && (
                      <span className="text-[11px] text-[#6B7280] truncate">{item.ai_reasoning}</span>
                    )}
                  </div>
                )}

                {/* Assigned badge */}
                {item.status === "assigned" && item.assigned_dossier && (
                  <div className="flex items-center gap-2 mb-3 p-2.5 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
                    <CheckCircle2 size={13} className="text-[#059669] flex-shrink-0" />
                    <span className="text-[12px] text-[#065F46]">
                      Assigné à <strong>{item.assigned_dossier.raison_sociale}</strong>
                    </span>
                  </div>
                )}

                {/* Actions */}
                {item.status === "unassigned" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <select
                        value={selected}
                        onChange={e => setSelectedDossier(p => ({ ...p, [item.id]: e.target.value }))}
                        className="select-arrow-none input pr-7 text-[12px] appearance-none"
                        style={{ minWidth: 200 }}
                      >
                        <option value="">Sélectionner un dossier…</option>
                        {item.ai_suggested_dossier && (
                          <option value={item.ai_suggested_dossier.id}>
                            {item.ai_suggested_dossier.raison_sociale} ← suggestion IA
                          </option>
                        )}
                        {dossiers
                          .filter(d => d.id !== item.ai_suggested_dossier?.id)
                          .map(d => <option key={d.id} value={d.id}>{d.raison_sociale}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] pointer-events-none" />
                    </div>

                    <button
                      disabled={!selected || saving === item.id}
                      onClick={() => assign(item, selected, selectedName)}
                      className="btn btn-gold btn-sm disabled:opacity-40"
                    >
                      {saving === item.id ? "…" : selected === item.ai_suggested_dossier?.id
                        ? <><CheckCircle2 size={13} /> Confirmer {selectedName}</>
                        : "Assigner"}
                    </button>

                    <button
                      onClick={() => ignore(item.id)}
                      className="btn btn-outline btn-sm text-[#6B7280]"
                    >
                      <XCircle size={13} /> Ignorer
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

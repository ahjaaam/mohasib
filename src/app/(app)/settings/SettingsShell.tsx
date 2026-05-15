"use client";

import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { Building2, User, Palette, CreditCard, Plug, MessageSquare, Settings } from "lucide-react";
import EntrepriseTab from "./EntrepriseTab";
import ProfilTab from "./ProfilTab";
import ApparenceTab from "./ApparenceTab";
import AbonnementTab from "./AbonnementTab";
import IntegrationsTab from "./IntegrationsTab";
import MessagesTab from "./MessagesTab";

interface Props {
  userId: string;
  userEmail: string;
  companyId: string | null;
  profile: any;
  company: any;
  prefs: any;
}

const TABS = [
  { id: "entreprise", label: "Entreprise", icon: Building2 },
  { id: "profil", label: "Profil personnel", icon: User },
  { id: "apparence", label: "Apparence", icon: Palette },
  { id: "abonnement", label: "Abonnement", icon: CreditCard },
  { id: "integrations", label: "Intégrations", icon: Plug },
  { id: "messages",     label: "Messages",     icon: MessageSquare },
];

export default function SettingsShell({ userId, userEmail, companyId, profile, company, prefs }: Props) {
  const [tab, setTab] = useState(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (TABS.some(x => x.id === t)) return t!;
    }
    return "entreprise";
  });

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />

      {/* Page header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(200,146,74,0.12)" }}>
          <Settings size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Paramètres</h1>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Gérez votre profil, entreprise et préférences</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* Left tab nav */}
        <div className="w-full md:w-[188px] flex-shrink-0">
          {/* Mobile: horizontal scroll */}
          <div className="md:hidden flex gap-1 overflow-x-auto pb-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] whitespace-nowrap transition-all flex-shrink-0 ${
                  tab === t.id
                    ? "bg-[#0D1526] text-white font-medium"
                    : "bg-white text-[#6B7280] border border-[rgba(0,0,0,0.08)] hover:text-[#1A1A2E]"
                }`}
              >
                <t.icon size={13} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Desktop: vertical nav */}
          <div className="hidden md:flex flex-col bg-white border border-[rgba(0,0,0,0.08)] rounded-xl overflow-hidden">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2.5 px-4 py-3 text-[12.5px] text-left transition-all border-l-2 ${
                  i < TABS.length - 1 ? "border-b border-[rgba(0,0,0,0.06)]" : ""
                } ${
                  tab === t.id
                    ? "border-l-[#C8924A] bg-[rgba(200,146,74,0.06)] text-[#1A1A2E] font-medium"
                    : "border-l-transparent text-[#6B7280] hover:text-[#1A1A2E] hover:bg-[#FAFAF6]"
                }`}
              >
                <t.icon size={14} className={tab === t.id ? "text-[#C8924A]" : ""} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {tab === "entreprise" && <EntrepriseTab userId={userId} company={company} />}
          {tab === "profil" && <ProfilTab userId={userId} userEmail={userEmail} profile={profile} prefs={prefs} />}
          {tab === "apparence" && <ApparenceTab userId={userId} company={company} />}
          {tab === "abonnement" && <AbonnementTab userId={userId} userEmail={userEmail} companyId={companyId} />}
          {tab === "integrations" && <IntegrationsTab company={company} />}
          {tab === "messages"     && <MessagesTab userId={userId} companyId={companyId} company={company} />}
        </div>
      </div>
    </>
  );
}

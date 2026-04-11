"use client";

import { useState } from "react";
import { Toaster } from "react-hot-toast";
import { Building2, User, Palette, CreditCard } from "lucide-react";
import EntrepriseTab from "./EntrepriseTab";
import ProfilTab from "./ProfilTab";
import ApparenceTab from "./ApparenceTab";
import AbonnementTab from "./AbonnementTab";

interface Props {
  userId: string;
  userEmail: string;
  profile: any;
  company: any;
  prefs: any;
}

const TABS = [
  { id: "entreprise", label: "Entreprise", icon: Building2 },
  { id: "profil", label: "Profil personnel", icon: User },
  { id: "apparence", label: "Apparence", icon: Palette },
  { id: "abonnement", label: "Abonnement", icon: CreditCard },
];

export default function SettingsShell({ userId, userEmail, profile, company, prefs }: Props) {
  const [tab, setTab] = useState("entreprise");

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
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
          {tab === "abonnement" && <AbonnementTab userId={userId} userEmail={userEmail} />}
        </div>
      </div>
    </>
  );
}

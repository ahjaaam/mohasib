"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, User, FileEdit, Mail, Receipt, Package, ArrowRight } from "lucide-react";
import { Toaster } from "react-hot-toast";
import ProfilTab from "@/app/(app)/settings/ProfilTab";
import IntegrationsTab from "@/app/(app)/settings/IntegrationsTab";
import InvoiceItemsTab from "@/app/(app)/settings/InvoiceItemsTab";
import DossierInvoiceSettingsTab from "./DossierInvoiceSettingsTab";

interface Props {
  dossierId: string;
  userId: string;
  ownerId: string;
  userEmail: string;
  profile: any;
  prefs: any;
  mailbox: any;
  invoiceBranding: any;
  isClientPortal: boolean;
}

type TabId = "profil" | "dossier" | "mailbox" | "facturation" | "articles";

export default function DossierSettingsClient({ dossierId, userId, ownerId, userEmail, profile, prefs, mailbox, invoiceBranding, isClientPortal }: Props) {
  const TABS = [
    { id: "profil" as TabId, label: "Mon profil", icon: User },
    ...(isClientPortal ? [
      { id: "facturation" as TabId, label: "Facturation", icon: Receipt },
      { id: "articles" as TabId, label: "Articles & prestations", icon: Package },
    ] : []),
    isClientPortal
      ? { id: "mailbox" as TabId, label: "Boîte mail", icon: Mail }
      : { id: "dossier" as TabId, label: "Dossier", icon: FileEdit },
  ];

  const [tab, setTab] = useState<TabId>(() => {
    if (typeof window !== "undefined") {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t === "integrations" && isClientPortal) return "mailbox";
      if (t === "facturation" && isClientPortal) return "facturation";
      if (t === "articles" && isClientPortal) return "articles";
      if (t === "dossier" && !isClientPortal) return "dossier";
    }
    return "profil";
  });

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />

      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(200,146,74,0.12)" }}>
          <Settings size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold text-[#1A1A2E] leading-none">Paramètres</h1>
          <p className="text-[11px] text-[#9CA3AF] mt-0.5">Gérez votre profil et vos préférences</p>
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
          {tab === "profil" && <ProfilTab userId={userId} userEmail={userEmail} profile={profile} prefs={prefs} />}

          {tab === "facturation" && isClientPortal && (
            <DossierInvoiceSettingsTab dossierId={dossierId} dossier={invoiceBranding} />
          )}

          {tab === "articles" && isClientPortal && (
            <InvoiceItemsTab userId={ownerId} dossierId={dossierId} />
          )}

          {tab === "mailbox" && isClientPortal && (
            <IntegrationsTab company={mailbox} dossierId={dossierId} />
          )}

          {tab === "dossier" && !isClientPortal && (
            <div className="card p-5">
              <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-2">Identité légale et accès client</h3>
              <p className="text-[12px] text-[#6B7280] mb-4">
                Modifiez l&apos;ICE, l&apos;IF, le RC, la CNSS, le régime TVA, les soldes initiaux et gérez l&apos;accès de votre client à ce dossier.
              </p>
              <Link href={`/comptable-pro/dossiers/${dossierId}/edit`} className="btn btn-gold inline-flex items-center gap-1.5">
                Modifier le dossier <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

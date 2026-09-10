"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import ProfilTab from "@/app/(app)/settings/ProfilTab";
import IntegrationsTab from "@/app/(app)/settings/IntegrationsTab";
import InvoiceItemsTab from "@/app/(app)/settings/InvoiceItemsTab";
import AccountingEntriesTab from "@/app/(app)/settings/AccountingEntriesTab";
import {
  CLIENT_DOSSIER_SETTINGS_TABS,
  DOSSIER_SETTINGS_TABS,
} from "@/lib/settings-navigation";
import DossierInvoiceSettingsTab from "./DossierInvoiceSettingsTab";
import EditDossierForm from "../edit/EditDossierForm";

interface Props {
  dossierId: string;
  dossierName: string;
  userId: string;
  ownerId: string;
  userEmail: string;
  profile: any;
  prefs: any;
  mailbox: any;
  invoiceBranding: any;
  accountingSettings: unknown;
  isClientPortal: boolean;
}

export default function DossierSettingsClient({
  dossierId,
  dossierName,
  userId,
  ownerId,
  userEmail,
  profile,
  prefs,
  mailbox,
  invoiceBranding,
  accountingSettings,
  isClientPortal,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabs = isClientPortal ? CLIENT_DOSSIER_SETTINGS_TABS : DOSSIER_SETTINGS_TABS;
  const requestedTab = searchParams.get("tab") === "mailbox"
    ? "integrations"
    : searchParams.get("tab");
  const tab = tabs.some((item) => item.id === requestedTab)
    ? requestedTab!
    : isClientPortal ? "profil" : "dossier";

  function selectTab(nextTab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <>
      <div className="mb-5 flex items-center gap-2.5">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(200,146,74,0.12)" }}
        >
          <Settings size={18} className="text-[#C8924A]" />
        </div>
        <div>
          <h1 className="text-[18px] font-bold leading-none text-[#1A1A2E]">Paramètres</h1>
          <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
            {isClientPortal
              ? `Gérez votre profil et les préférences de ${dossierName}`
              : `Ces paramètres s’appliquent uniquement au dossier ${dossierName}`}
          </p>
        </div>
      </div>

      {/* On desktop, the dossier sidebar becomes the settings navigation. */}
      <div className="md:hidden flex gap-1 overflow-x-auto pb-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => selectTab(item.id)}
            className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[12px] transition-all ${
              tab === item.id
                ? "bg-[#0D1526] text-white font-medium"
                : "bg-white text-[#6B7280] border border-[rgba(0,0,0,0.08)] hover:text-[#1A1A2E]"
            }`}
          >
            <item.icon size={13} />
            {item.label}
          </button>
        ))}
      </div>

      <div className="settings-content min-w-0 max-w-[900px]">
        {tab === "profil" && isClientPortal && (
          <ProfilTab userId={userId} userEmail={userEmail} profile={profile} prefs={prefs} />
        )}

        {tab === "dossier" && !isClientPortal && (
          <EditDossierForm embedded />
        )}

        {tab === "facturation" && (
          <DossierInvoiceSettingsTab dossierId={dossierId} dossier={invoiceBranding} />
        )}

        {tab === "articles" && (
          <InvoiceItemsTab userId={ownerId} dossierId={dossierId} />
        )}

        {tab === "ecritures" && !isClientPortal && (
          <AccountingEntriesTab
            target="dossier"
            targetId={dossierId}
            initialSettings={accountingSettings}
          />
        )}

        {tab === "integrations" && isClientPortal && (
          <IntegrationsTab company={mailbox} dossierId={dossierId} />
        )}
      </div>
    </>
  );
}

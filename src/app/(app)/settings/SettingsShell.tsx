"use client";

import { useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import EntrepriseTab from "./EntrepriseTab";
import ProfilTab from "./ProfilTab";
import ApparenceTab from "./ApparenceTab";
import AbonnementTab from "./AbonnementTab";
import IntegrationsTab from "./IntegrationsTab";
import MessagesTab from "./MessagesTab";
import TVAConfigTab from "@/components/parametres/TVAConfigTab";
import TeamTab from "@/components/settings/TeamTab";
import DeadlinesTab from "./DeadlinesTab";
import InvoiceItemsTab from "./InvoiceItemsTab";
import AccountingEntriesTab from "./AccountingEntriesTab";
import { usePlanEntitlements } from "@/hooks/usePlanEntitlements";
import { usePermissions } from "@/hooks/usePermissions";
import AccessRestricted from "@/components/AccessRestricted";
import { SETTINGS_TABS, settingsTabAllowedOnPlan } from "@/lib/settings-navigation";

interface Props {
  userId: string;
  accountOwnerId: string;
  userEmail: string;
  companyId: string | null;
  profile: any;
  company: any;
  prefs: any;
}

export default function SettingsShell({ userId, accountOwnerId, userEmail, companyId, profile, company, prefs }: Props) {
  const searchParams = useSearchParams();
  const entitlements = usePlanEntitlements();
  const { can, isOwner } = usePermissions();
  const planAllowsTab = (id: string) => settingsTabAllowedOnPlan(id, entitlements.plan);
  const visibleTabs = SETTINGS_TABS.filter(item => planAllowsTab(item.id) && (item.id !== "equipe" || entitlements.features.multi_users));
  const requestedTab = searchParams.get("tab");
  const tab = visibleTabs.some((item) => item.id === requestedTab) ? requestedTab! : "entreprise";
  const activeTab = SETTINGS_TABS.find(item => item.id === tab);
  const tabAllowedByPlan = planAllowsTab(tab);
  const tabAllowed = tabAllowedByPlan && (isOwner || (!activeTab?.ownerOnly && (!activeTab?.permission || can(...activeTab.permission.split(":") as [string, string]))));

  return (
    <>
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

      {/* Tab content */}
      <div className="settings-content min-w-0 max-w-[900px]">
          {!tabAllowed && <AccessRestricted backHref="/parametres" reason={tabAllowedByPlan ? "permission" : "plan"} />}
          {tabAllowed && <>
          {tab === "entreprise" && <EntrepriseTab userId={accountOwnerId} company={company} />}
          {tab === "profil" && <ProfilTab userId={userId} userEmail={userEmail} profile={profile} prefs={prefs} />}
          {tab === "apparence" && <ApparenceTab userId={accountOwnerId} company={company} prefs={prefs} />}
          {tab === "abonnement" && <AbonnementTab userId={accountOwnerId} userEmail={userEmail} companyId={companyId} company={company} />}
          {tab === "integrations" && <IntegrationsTab company={company} />}
          {tab === "articles"     && <InvoiceItemsTab userId={accountOwnerId} />}
          {tab === "ecritures"    && companyId && (
            <AccountingEntriesTab target="company" targetId={companyId} initialSettings={company?.accounting_settings} />
          )}
          {tab === "tva"          && <TVAConfigTab companyId={companyId} />}
          {tab === "echeances"    && (
            <DeadlinesTab
              userId={accountOwnerId}
              deadlines={prefs.dashboard_deadlines ?? null}
              tvaRegime={company?.tva_regime ?? null}
              tvaAssujetti={company?.tva_assujetti ?? null}
            />
          )}
          {tab === "messages"     && <MessagesTab userId={accountOwnerId} companyId={companyId} company={company} />}
          {tab === "equipe"       && entitlements.features.multi_users && <TeamTab />}
          </>}
      </div>
    </>
  );
}

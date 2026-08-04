"use client";

import InvoicesPage from "@/app/(app)/invoices/page";
import ClientsPage from "@/app/(app)/clients/page";
import InvoiceItemsTab from "@/app/(app)/settings/InvoiceItemsTab";
import { AccountOwnerProvider } from "@/hooks/useAccountOwner";
import { PlanEntitlementsProvider } from "@/hooks/usePlanEntitlements";
import type { PlanEntitlements } from "@/lib/plan-features";

export const GUEST_INVOICING_ENTITLEMENTS: PlanEntitlements = {
  plan: "free",
  features: {
    bank_import: false,
    saisie: false,
    paie: false,
    export_fiduciaire: false,
    avoirs: true,
    bilan: false,
    tva_edi: false,
    inbox_global: false,
    mass_declarations: false,
    multi_users: false,
  },
  limits: { ocr: 0, storageGb: 0, dossiers: 0, users: 1, employees: 0 },
};

type Section = "factures" | "devis" | "avoirs" | "clients" | "articles";

export default function GuestFacturationContent({ section }: { section: Section }) {
  return (
    <PlanEntitlementsProvider value={GUEST_INVOICING_ENTITLEMENTS}>
      <AccountOwnerProvider ownerId="">
        {section === "clients" ? <ClientsPage />
          : section === "articles" ? <InvoiceItemsTab userId="" />
            : section === "devis" ? <InvoicesPage initialMode="devis" />
              : section === "avoirs" ? <InvoicesPage initialMode="avoirs" />
                : <InvoicesPage />}
      </AccountOwnerProvider>
    </PlanEntitlementsProvider>
  );
}

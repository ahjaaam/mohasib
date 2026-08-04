import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import GuestAuthGate from "@/components/GuestAuthGate";
import { GUEST_INVOICING_ENTITLEMENTS } from "@/components/GuestFacturationContent";
import { INVOICING_URL, marketingUrl } from "@/lib/public-urls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(INVOICING_URL),
  title: "Logiciel de facturation gratuit au Maroc | Mohasib",
  description: "Créez et gérez gratuitement vos factures, devis, avoirs et clients. Outil de facturation marocain avec TVA, ICE et PDF professionnel.",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Logiciel de facturation gratuit au Maroc | Mohasib",
    description: "Gérez gratuitement vos factures, devis, avoirs et clients avec un outil conçu pour les entreprises marocaines.",
    url: "/",
    type: "website",
    locale: "fr_MA",
    siteName: "Mohasib Facturation",
    images: [{
      url: marketingUrl("/og-image-2026.png"),
      width: 1920,
      height: 1080,
      alt: "Logiciel de facturation gratuit Mohasib pour les entreprises marocaines",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Logiciel de facturation gratuit au Maroc | Mohasib",
    description: "Factures, devis, avoirs, clients, TVA et PDF professionnel dans un outil de facturation marocain gratuit.",
    images: [marketingUrl("/og-image-2026.png")],
  },
};

const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Mohasib Facturation",
  url: `${INVOICING_URL}/`,
  description: "Logiciel de facturation gratuit pour créer et gérer des factures, devis, avoirs et clients au Maroc.",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  browserRequirements: "Navigateur web moderne",
  inLanguage: "fr-MA",
  featureList: [
    "Création de factures",
    "Création de devis",
    "Gestion des avoirs clients",
    "Gestion des clients",
    "Calcul de la TVA",
    "Export PDF professionnel",
  ],
  offers: {
    "@type": "Offer",
    price: 0,
    priceCurrency: "MAD",
    availability: "https://schema.org/InStock",
  },
  publisher: {
    "@type": "Organization",
    name: "Mohasib AI",
    url: marketingUrl(),
  },
};

export default function GuestFacturationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }} />
      <GuestAuthGate>
        <AppShell ownerId="" entitlements={GUEST_INVOICING_ENTITLEMENTS} guestMode>
          {children}
        </AppShell>
      </GuestAuthGate>
    </>
  );
}

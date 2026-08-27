import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MARKETING_URL } from "@/lib/public-urls";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import PWARegistration from "@/components/PWARegistration";

export const metadata: Metadata = {
  metadataBase: new URL(MARKETING_URL),
  applicationName: "Mohasib",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Mohasib",
  },
  formatDetection: {
    telephone: false,
  },
  title: "Mohasib — Comptabilité IA pour entrepreneurs marocains",
  description:
    "Factures, TVA, Paie et comptable dédié. Conçu pour les PME marocaines.",
  openGraph: {
    title: "Mohasib — Comptabilité IA pour entrepreneurs marocains",
    description:
      "Factures, TVA, Paie et comptable dédié. Conçu pour les PME marocaines.",
    type: "website",
    images: [
      {
        url: "/og-image-2026.png",
        width: 1920,
        height: 1080,
        alt: "Mohasib AI",
      }
    ],
    locale: "fr_MA",
    siteName: "Mohasib AI",
  },
  
  twitter: {
    card: "summary_large_image",
    title: "Mohasib — Comptabilité IA pour entrepreneurs marocains",
    description: "Factures, TVA, Paie et comptable dédié. Conçu pour les PME marocaines.",
    images: ["/og-image-2026.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FDFBF6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body suppressHydrationWarning style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationJsonLd, websiteJsonLd]) }}
        />
        {children}
        <PWARegistration />
        <PWAInstallPrompt />
      </body>
    </html>
  );
}

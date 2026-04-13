import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mohasib — Comptabilité IA pour entrepreneurs marocains",
  description:
    "Créez vos factures, gérez votre TVA et accédez à un comptable dédié. Conçu pour les PME marocaines. Dès 199 MAD/mois.",
  openGraph: {
    title: "Mohasib — Comptabilité IA pour entrepreneurs marocains",
    description:
      "Créez vos factures, gérez votre TVA et accédez à un comptable dédié. Conçu pour les PME marocaines. Dès 199 MAD/mois.",
    type: "website",
    locale: "fr_MA",
    siteName: "Mohasib",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mohasib — Comptabilité IA pour entrepreneurs marocains",
    description: "Créez vos factures, gérez votre TVA. Dès 199 MAD/mois.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={{ scrollBehavior: "smooth" }}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

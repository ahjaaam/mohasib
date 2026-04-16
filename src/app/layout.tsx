import type { Metadata } from "next";
import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mohasib — Comptabilité IA pour entrepreneurs marocains",
  description:
    "Factures, TVA, Paie et comptable dédié. Conçu pour les PME marocaines. Dès 199 MAD/mois.",
  openGraph: {
    title: "Mohasib — Comptabilité IA pour entrepreneurs marocains",
    description:
      "Factures, TVA, Paie et comptable dédié. Conçu pour les PME marocaines. Dès 199 MAD/mois.",
    type: "website",
    locale: "fr_MA",
    siteName: "Mohasib",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mohasib — Comptabilité IA pour entrepreneurs marocains",
    description: "Factures, TVA, Paie et comptable dédié. Dès 199 MAD/mois.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={{ scrollBehavior: "smooth" }} className={jakarta.variable}>
      <body suppressHydrationWarning style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

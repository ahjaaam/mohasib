import type { Metadata } from "next";
import "./globals.css";
import { Plus_Jakarta_Sans, Instrument_Serif } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const serif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  icons: { icon: "/favicon.png" },
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
        url: 'https://www.mohasibai.com/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Mohasib AI Dashboard',
      }
    ],
    locale: "fr_MA",
    siteName: "Mohasib AI",
  },
  
  twitter: {
    card: "summary_large_image",
    title: "Mohasib — Comptabilité IA pour entrepreneurs marocains",
    description: "Factures, TVA, Paie et comptable dédié. Conçu pour les PME marocaines.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" style={{ scrollBehavior: "smooth" }} className={`${jakarta.variable} ${serif.variable}`}>
      <body suppressHydrationWarning style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mohasib — Comptabilité pour PME Marocaines",
  description:
    "Logiciel de comptabilité intelligent pour les PME marocaines. Gérez vos factures, clients et transactions avec l'IA.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}

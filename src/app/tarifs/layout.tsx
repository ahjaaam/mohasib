import type { Metadata } from "next";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = seoMetadata({
  title: "Simulateur de prix Mohasib AI — Entreprise et cabinet comptable",
  description: "Calculez le prix mensuel TTC de Mohasib AI selon vos espaces, dossiers, utilisateurs, documents OCR et employés en paie.",
  path: "/tarifs",
});

export default function TarifsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

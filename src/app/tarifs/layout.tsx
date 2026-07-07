import type { Metadata } from "next";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = seoMetadata({
  title: "Tarifs Mohasib AI — Plans facturation, comptabilité et cabinet au Maroc",
  description: "Comparez les plans Mohasib AI pour entrepreneurs, PME et cabinets comptables au Maroc : facturation, TVA, paie, OCR, dossiers clients et exports.",
  path: "/tarifs",
});

export default function TarifsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

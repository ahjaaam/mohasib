import { notFound } from "next/navigation";
import { FEATURES } from "@/lib/features";

export default function RapprochementLayout({ children }: { children: React.ReactNode }) {
  if (!FEATURES.RAPPROCHEMENT_ENABLED) notFound();

  return children;
}

"use client";

import { useParams } from "next/navigation";
import RapprochementPage from "@/app/(app)/rapprochement/page";

export default function DossierRapprochementPage() {
  const params = useParams();
  return <RapprochementPage dossierId={params.id as string} />;
}

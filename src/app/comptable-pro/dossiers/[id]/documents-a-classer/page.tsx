"use client";

import { useParams } from "next/navigation";
import UnclassifiedDocumentsManager from "@/components/UnclassifiedDocumentsManager";

export default function DossierUnclassifiedDocumentsPage() {
  const params = useParams();
  return <UnclassifiedDocumentsManager dossierId={params.id as string} />;
}

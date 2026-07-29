"use client";

import { useParams } from "next/navigation";
import ReceiptsManager from "@/app/(app)/receipts/ReceiptsManager";

export default function DossierReceiptsPage() {
  const params = useParams();
  return <ReceiptsManager dossierId={params.id as string} />;
}

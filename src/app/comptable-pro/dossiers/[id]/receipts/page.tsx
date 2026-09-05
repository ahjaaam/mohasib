"use client";

import { useParams } from "next/navigation";
import InboxPage from "@/app/(app)/inbox/page";

export default function DossierReceiptsPage() {
  const params = useParams();
  return <InboxPage dossierId={params.id as string} workspace="expenses" />;
}

"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import ClientsPage from "@/app/(app)/clients/page";

function ClientsWrapper() {
  const params = useParams();
  return <ClientsPage dossierId={params.id as string} />;
}

export default function DossierClientsPage() {
  return (
    <Suspense>
      <ClientsWrapper />
    </Suspense>
  );
}

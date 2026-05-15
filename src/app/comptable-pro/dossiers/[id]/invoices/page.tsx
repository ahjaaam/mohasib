"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import InvoicesPage from "@/app/(app)/invoices/page";

function InvoicesWrapper() {
  const params = useParams();
  return <InvoicesPage dossierId={params.id as string} />;
}

export default function DossierInvoicesPage() {
  return (
    <Suspense>
      <InvoicesWrapper />
    </Suspense>
  );
}

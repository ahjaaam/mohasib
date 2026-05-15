"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import TransactionsPage from "@/app/(app)/transactions/page";

function TransactionsWrapper() {
  const params = useParams();
  return <TransactionsPage dossierId={params.id as string} />;
}

export default function DossierTransactionsPage() {
  return (
    <Suspense>
      <TransactionsWrapper />
    </Suspense>
  );
}

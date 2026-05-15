"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import PaiePage from "@/app/(app)/paie/page";

function PaieWrapper() {
  const params = useParams();
  return <PaiePage dossierId={params.id as string} />;
}

export default function DossierPaiePage() {
  return (
    <Suspense>
      <PaieWrapper />
    </Suspense>
  );
}

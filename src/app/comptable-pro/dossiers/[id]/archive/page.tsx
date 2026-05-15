"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import ArchivePage from "@/app/(app)/archive/page";

function ArchiveWrapper() {
  const params = useParams();
  return <ArchivePage dossierId={params.id as string} />;
}

export default function DossierArchivePage() {
  return (
    <Suspense>
      <ArchiveWrapper />
    </Suspense>
  );
}

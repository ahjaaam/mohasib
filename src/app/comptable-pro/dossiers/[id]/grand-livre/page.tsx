export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import GrandLivreView from "@/components/GrandLivreView";
import { FEATURES } from "@/lib/features";

export default async function FiduciaireGrandLivrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!FEATURES.GRAND_LIVRE_ENABLED) redirect(`/comptable-pro/dossiers/${id}/export-fiduciaire`);

  return (
    <GrandLivreView
      dossierId={id}
      title="Grand Livre"
    />
  );
}

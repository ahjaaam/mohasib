export const dynamic = "force-dynamic";

import GrandLivreView from "@/components/GrandLivreView";

export default async function FiduciaireGrandLivrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <GrandLivreView
      dossierId={id}
      title="Grand Livre"
    />
  );
}

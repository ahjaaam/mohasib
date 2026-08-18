import { TreasuryWorkspace } from "@/app/(app)/tresorerie/page";

export default async function DossierTreasuryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TreasuryWorkspace dossierId={id} />;
}

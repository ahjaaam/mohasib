import { redirect } from "next/navigation";

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/comptable-pro/dossiers/${id}/tableau-de-bord`);
}

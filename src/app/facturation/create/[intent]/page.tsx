import GuestFacturationContent from "@/components/GuestFacturationContent";

export default async function GuestCreatePage({ params }: { params: Promise<{ intent: string }> }) {
  const { intent } = await params;
  if (intent === "client" || intent === "import") return <GuestFacturationContent section="clients" />;
  if (intent === "article") return <GuestFacturationContent section="articles" />;
  if (intent === "devis") return <GuestFacturationContent section="devis" />;
  if (intent === "avoir") return <GuestFacturationContent section="avoirs" />;
  return <GuestFacturationContent section="factures" />;
}

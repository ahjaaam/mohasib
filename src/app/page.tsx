import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomePageClient from "./HomePageClient";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = seoMetadata({
  title: "Mohasib AI — Logiciel de comptabilité, facturation et TVA au Maroc",
  description: "Logiciel de comptabilité marocain pour créer vos factures, suivre vos paiements, gérer vos documents, préparer la TVA, la paie et vos exports comptables.",
  path: "/",
});

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return <HomePageClient />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomePageClient from "./HomePageClient";
import { seoMetadata } from "@/lib/seo";

export const metadata: Metadata = seoMetadata({
  title: "Mohasib AI — Automatisez votre gestion comptable au Maroc",
  description: "Centralisez vos factures, paiements et notes de frais. Mohasib prépare vos écritures, votre TVA et vos exports pour vous aider à décider plus vite.",
  path: "/",
});

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/tableau-de-bord");
  return <HomePageClient />;
}

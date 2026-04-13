import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomePageClient from "./HomePageClient";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return <HomePageClient />;
}

import { Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import ChatInterface from "./ChatInterface";

export default async function ChatPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("full_name,avatar_url").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <div className="flex h-full min-h-[600px] flex-col">
      <PageHeader
        title="Mohasib Agent"
        subtitle="Votre assistant comptable spécialisé pour les entreprises marocaines"
        icon={<Sparkles size={18} />}
      />
      <div className="min-h-0 flex-1 border border-[rgba(0,0,0,0.09)] bg-white">
        <ChatInterface
          userName={profile?.full_name ?? user?.user_metadata?.full_name ?? user?.email}
          avatarUrl={profile?.avatar_url}
        />
      </div>
    </div>
  );
}

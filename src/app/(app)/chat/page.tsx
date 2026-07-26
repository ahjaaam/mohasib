import { Sparkles } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ChatInterface from "./ChatInterface";

export default function ChatPage() {
  return (
    <div className="flex h-full min-h-[600px] flex-col">
      <PageHeader
        title="Mohasib Chat"
        subtitle="Votre assistant comptable spécialisé pour les entreprises marocaines"
        icon={<Sparkles size={18} />}
      />
      <div className="min-h-0 flex-1 border border-[rgba(0,0,0,0.09)] bg-white">
        <ChatInterface />
      </div>
    </div>
  );
}

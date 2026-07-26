"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { History, Menu, MessageSquare, Plus, Send, Sparkles, Trash2, X } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  updated_at: string;
};

const WELCOME: Message = {
  role: "assistant",
  content:
    "Bonjour, je suis Mohasib Chat. Posez-moi vos questions sur la comptabilité, la TVA, l’IS, l’IR ou les obligations des entreprises marocaines.",
};

const SUGGESTIONS = [
  "Comment calculer la TVA à déclarer ?",
  "Explique-moi les acomptes de l’IS",
  "Quelles mentions sont obligatoires sur une facture ?",
  "Comment comptabiliser une facture fournisseur ?",
];

export default function ChatInterface({
  mode = "page",
  onClose,
  dossierId,
}: {
  mode?: "page" | "dock";
  onClose?: () => void;
  dossierId?: string;
}) {
  const isDock = mode === "dock";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch("/api/chat/history");
      if (!response.ok) return;
      const json = await response.json();
      setConversations(json.conversations ?? []);
    } catch {
      // The chat remains usable when history cannot be loaded.
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: loading ? "auto" : "smooth" });
  }, [loading, messages]);

  async function openConversation(id: string) {
    setActiveId(id);
    setHistoryOpen(false);
    try {
      const response = await fetch(`/api/chat/history?id=${encodeURIComponent(id)}`);
      if (!response.ok) return;
      const json = await response.json();
      setMessages([WELCOME, ...(json.messages ?? [])]);
    } catch {
      setMessages([WELCOME]);
    }
  }

  function newConversation() {
    setActiveId(null);
    setMessages([WELCOME]);
    setInput("");
    setHistoryOpen(false);
    inputRef.current?.focus();
  }

  async function deleteConversation(id: string, event: React.MouseEvent) {
    event.stopPropagation();
    const response = await fetch(`/api/chat/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!response.ok) return;
    if (activeId === id) newConversation();
    setConversations((current) => current.filter((conversation) => conversation.id !== id));
  }

  async function send(content: string) {
    const cleanContent = content.trim();
    if (!cleanContent || loading) return;

    const userMessage: Message = { role: "user", content: cleanContent };
    const apiHistory = [...messages.slice(1), userMessage];
    setMessages((current) => [...current, userMessage, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiHistory, conversation_id: activeId, dossier_id: dossierId }),
      });
      if (!response.ok || !response.body) throw new Error("Chat unavailable");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.split("\n").find((part) => part.startsWith("data: "));
          if (!line) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.conversation_id) setActiveId(parsed.conversation_id);
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              setMessages((current) => {
                const updated = [...current];
                const last = updated.length - 1;
                updated[last] = { role: "assistant", content: updated[last].content + parsed.text };
                return updated;
              });
            }
          } catch (error) {
            if (error instanceof SyntaxError) continue;
            throw error;
          }
        }
      }

      void loadConversations();
    } catch {
      setMessages((current) => {
        const updated = [...current];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Le service est momentanément indisponible. Veuillez réessayer dans quelques instants.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  const historyPanel = (
    <aside className="flex h-full w-[240px] flex-shrink-0 flex-col border-r border-[rgba(0,0,0,0.08)] bg-[#FAFAF7]">
      <div className="flex h-[52px] items-center gap-2 border-b border-[rgba(0,0,0,0.08)] p-2.5">
        <button
          type="button"
          onClick={newConversation}
          className="flex h-8 flex-1 items-center justify-center gap-2 bg-[#0D1526] px-3 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#1B2840]"
        >
          <Plus size={13} />
          Nouvelle conversation
        </button>
        <button
          type="button"
          onClick={() => setHistoryOpen(false)}
          className={`h-8 w-8 items-center justify-center text-[#777E8B] hover:bg-[#EFEEE9] ${
            isDock ? "flex" : "flex md:hidden"
          }`}
          aria-label="Fermer l’historique"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-1 flex items-center gap-1.5 px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.8px] text-[#9A9FA8]">
          <History size={11} />
          Historique
        </div>
        {conversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11px] text-[#9CA3AF]">
            <MessageSquare size={18} className="mx-auto mb-2 text-[#C8CBD0]" />
            Aucune conversation
          </div>
        ) : (
          conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`group flex w-full items-center gap-2 border-l-2 px-2.5 py-2 text-left transition-colors ${
                activeId === conversation.id
                  ? "border-[#C8924A] bg-[rgba(200,146,74,0.09)] text-[#8A5E24]"
                  : "border-transparent text-[#525866] hover:bg-[#F0EFEA]"
              }`}
            >
              <button
                type="button"
                onClick={() => void openConversation(conversation.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <MessageSquare size={12} className="flex-shrink-0 opacity-55" />
                <span className="min-w-0 flex-1 truncate text-[11.5px]">{conversation.title}</span>
              </button>
              <button
                type="button"
                onClick={(event) => void deleteConversation(conversation.id, event)}
                className="flex h-6 w-6 items-center justify-center text-[#A0A5AE] opacity-0 transition-all hover:text-[#DC2626] group-hover:opacity-100"
                aria-label={`Supprimer ${conversation.title}`}
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      {!isDock && <div className="hidden h-full md:block">{historyPanel}</div>}

      {historyOpen && (
        <>
          <button
            type="button"
            className={`absolute inset-0 z-20 bg-black/20 ${isDock ? "" : "md:hidden"}`}
            onClick={() => setHistoryOpen(false)}
            aria-label="Fermer l’historique"
          />
          <div className={`absolute inset-y-0 left-0 z-30 ${isDock ? "" : "md:hidden"}`}>{historyPanel}</div>
        </>
      )}

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="flex h-[52px] flex-shrink-0 items-center justify-between border-b border-[rgba(0,0,0,0.08)] px-3.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className={`h-8 w-8 items-center justify-center text-[#777E8B] hover:bg-[#F4F3ED] ${
                isDock ? "flex" : "flex md:hidden"
              }`}
              aria-label="Ouvrir l’historique"
            >
              <Menu size={15} />
            </button>
            <span className="flex h-7 w-7 items-center justify-center bg-[rgba(200,146,74,0.12)] text-[#C8924A]">
              <Sparkles size={14} />
            </span>
            <span>
              <span className="block text-[11.5px] font-bold leading-tight text-[#1A1A2E]">Assistant Mohasib</span>
              <span className="mt-0.5 block text-[9.5px] leading-tight text-[#8A909B]">Comptabilité marocaine</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden items-center gap-1.5 text-[9.5px] text-[#7B818C] sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#22A06B]" />
              Disponible
            </span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center text-[#777E8B] transition-colors hover:bg-[#F4F3ED] hover:text-[#1A1A2E]"
                aria-label="Fermer Mohasib Chat"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-[#FCFCFA] px-4 py-5">
          <div className="mx-auto flex w-full max-w-[760px] flex-col gap-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex max-w-[88%] gap-2.5 ${message.role === "user" ? "self-end flex-row-reverse" : "self-start"}`}
              >
                <span
                  className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[9.5px] font-bold ${
                    message.role === "assistant"
                      ? "bg-[#C8924A] text-white"
                      : "bg-[#0D1526] text-white"
                  }`}
                >
                  {message.role === "assistant" ? "M" : "V"}
                </span>
                <div
                  className={`border px-3.5 py-2.5 text-[12.5px] leading-[1.6] whitespace-pre-wrap ${
                    message.role === "assistant"
                      ? "border-[#E2E1DC] bg-white text-[#303644]"
                      : "border-[#0D1526] bg-[#0D1526] text-white"
                  }`}
                >
                  {!message.content ? (
                    <span className="flex items-center gap-1 py-1">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </span>
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="border border-[#E2E1DC] bg-white px-3 py-2.5 text-left text-[11.5px] text-[#525866] transition-colors hover:border-[#D8C19D] hover:text-[#8A5E24]"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <form
          className="flex-shrink-0 border-t border-[rgba(0,0,0,0.08)] bg-white px-3.5 py-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <div className="mx-auto flex max-w-[760px] gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Posez votre question comptable…"
              disabled={loading}
              className="h-10 min-w-0 flex-1 border border-[#D8D8D3] bg-white px-3.5 text-[12.5px] text-[#1A1A2E] outline-none transition-colors placeholder:text-[#A0A5AE] focus:border-[#C8924A]"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-[#C8924A] text-white transition-colors hover:bg-[#B8823A] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Envoyer le message"
            >
              <Send size={15} />
            </button>
          </div>
          <p className="mx-auto mt-1.5 max-w-[760px] text-center text-[9px] text-[#A0A5AE]">
            Vérifiez les informations sensibles avec votre expert-comptable.
          </p>
        </form>
      </section>
    </div>
  );
}

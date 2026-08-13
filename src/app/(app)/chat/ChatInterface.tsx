"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, History, Menu, MessageSquare, Plus, Sparkles, Trash2, X } from "lucide-react";

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
    "Bonjour, je suis l’agent Mohasib. Je peux analyser vos données comptables et agir dans Mohasib. Demandez-moi par exemple de préparer une facture pour un client.",
};

const SUGGESTIONS = [
  "Crée une facture de 5 000 MAD HT pour Atlas",
  "Quelles factures sont en retard ?",
  "Comment calculer la TVA à déclarer ?",
  "Quel est mon chiffre d’affaires ce mois-ci ?",
];

function MessageContent({ content }: { content: string }) {
  const blocks = content.split(/\n{2,}/).filter(Boolean);

  return (
    <div className="space-y-2.5">
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n");
        const isList = lines.every((line) => /^\s*[-*]\s+/.test(line));

        if (isList) {
          return (
            <ul key={blockIndex} className="space-y-1.5 pl-4 marker:text-[#C8924A]">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{line.replace(/^\s*[-*]\s+/, "")}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={blockIndex} className="whitespace-pre-wrap">
            {block}
          </p>
        );
      })}
    </div>
  );
}

export default function ChatInterface({
  mode = "page",
  onClose,
  dossierId,
}: {
  mode?: "page" | "dock";
  onClose?: () => void;
  dossierId?: string;
  userName?: string | null;
  avatarUrl?: string | null;
}) {
  const isDock = mode === "dock";
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => () => {
    if (typingTimerRef.current !== null) clearTimeout(typingTimerRef.current);
  }, []);

  useEffect(() => {
    if (!inputRef.current) return;
    inputRef.current.style.height = "0px";
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 128)}px`;
  }, [input]);

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

    let pendingText = "";
    let streamFinished = false;
    let resolveTyping: () => void = () => {};
    const typingFinished = new Promise<void>((resolve) => {
      resolveTyping = resolve;
    });

    const revealText = () => {
      typingTimerRef.current = null;

      if (pendingText.length > 0) {
        const charactersPerTick = pendingText.length > 240 ? 12 : pendingText.length > 80 ? 6 : 2;
        const visibleText = pendingText.slice(0, charactersPerTick);
        pendingText = pendingText.slice(charactersPerTick);

        setMessages((current) => {
          const updated = [...current];
          const last = updated.length - 1;
          updated[last] = { role: "assistant", content: updated[last].content + visibleText };
          return updated;
        });
      }

      if (pendingText.length > 0) {
        typingTimerRef.current = setTimeout(revealText, 24);
      } else if (streamFinished) {
        resolveTyping();
      }
    };

    const queueText = (text: string) => {
      pendingText += text;
      if (typingTimerRef.current === null) typingTimerRef.current = setTimeout(revealText, 24);
    };

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
            if (parsed.text) queueText(parsed.text);
          } catch (error) {
            if (error instanceof SyntaxError) continue;
            throw error;
          }
        }
      }

      streamFinished = true;
      if (typingTimerRef.current === null) {
        if (pendingText.length > 0) {
          typingTimerRef.current = setTimeout(revealText, 24);
        } else {
          resolveTyping();
        }
      }
      await typingFinished;
      void loadConversations();
    } catch {
      if (typingTimerRef.current !== null) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
      pendingText = "";
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
          className="flex h-9 flex-1 items-center justify-center gap-2 bg-[#0D1526] px-3 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#1B2840] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8924A]"
        >
          <Plus size={13} />
          Nouvelle conversation
        </button>
        <button
          type="button"
          onClick={() => setHistoryOpen(false)}
          className={`h-9 w-9 items-center justify-center text-[#777E8B] hover:bg-[#EFEEE9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8924A] ${
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
                className="flex h-8 w-8 items-center justify-center text-[#A0A5AE] opacity-0 transition-all hover:bg-[#FDECEC] hover:text-[#DC2626] focus:opacity-100 group-hover:opacity-100"
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

  const isEmptyConversation = messages.length === 1;
  const conversationMessages = isEmptyConversation ? [] : messages.slice(1);

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
        <div className="flex h-16 flex-shrink-0 items-center justify-between border-b border-[rgba(0,0,0,0.08)] bg-white px-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className={`h-10 w-10 items-center justify-center text-[#777E8B] hover:bg-[#F4F3ED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8924A] ${
                isDock ? "flex" : "flex md:hidden"
              }`}
              aria-label="Ouvrir l’historique"
            >
              <Menu size={15} />
            </button>
            <span className="relative flex h-9 w-9 items-center justify-center bg-[rgba(200,146,74,0.12)] text-[#C8924A]">
              <Sparkles size={16} />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#22A06B]" />
            </span>
            <span>
              <span className="block text-[13px] font-bold leading-tight text-[#1A1A2E]">Assistant Mohasib</span>
              <span className="mt-1 block text-[10px] leading-tight text-[#7B818C]">Votre copilote comptable</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden border border-[#DDE9E3] bg-[#F4FAF7] px-2 py-1 text-[9.5px] font-medium text-[#217A55] sm:block">Disponible</span>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center text-[#777E8B] transition-colors hover:bg-[#F4F3ED] hover:text-[#1A1A2E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C8924A]"
                aria-label="Fermer Mohasib Agent"
              >
                <X size={15} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto bg-white px-3 py-5 sm:px-5 sm:py-8" aria-live="polite">
          <div className={`mx-auto flex w-full max-w-[720px] flex-1 flex-col ${isEmptyConversation ? "justify-center" : "gap-6"}`}>
            {isEmptyConversation && (
              <div className="mx-auto mb-7 max-w-[520px] text-center">
                <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center bg-[rgba(200,146,74,0.12)] text-[#C8924A]">
                  <Sparkles size={18} />
                </span>
                <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-[#1A1A2E] sm:text-[24px]">
                  Comment puis-je vous aider ?
                </h2>
                <p className="mx-auto mt-2 max-w-[440px] text-[12px] leading-relaxed text-[#7B818C]">
                  Posez une question sur votre comptabilité ou demandez-moi d’effectuer une tâche dans Mohasib.
                </p>
              </div>
            )}

            {conversationMessages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={message.role === "user" ? "max-w-[86%] self-end" : "w-full self-start"}
              >
                <div
                  className={`min-w-0 text-[13px] leading-[1.7] ${
                    message.role === "assistant"
                      ? "px-1 py-1 text-[#303644]"
                      : "chat-message-bubble bg-[#F1F1EE] px-4 py-3 text-[#242936]"
                  }`}
                >
                  {!message.content ? (
                    <span className="flex items-center gap-1 py-1">
                      <span className="dot" />
                      <span className="dot" />
                      <span className="dot" />
                    </span>
                  ) : (
                    <>
                      <MessageContent content={message.content} />
                      {loading && message.role === "assistant" && index === conversationMessages.length - 1 && (
                        <span
                          className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-[#C8924A] align-[-2px]"
                          aria-hidden="true"
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {isEmptyConversation && (
              <div className="mx-auto grid w-full max-w-[600px] grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => void send(suggestion)}
                    className="min-h-14 border border-[#E2E1DC] bg-white px-4 py-3.5 text-left text-[11.5px] leading-snug text-[#525866] transition-colors hover:border-[#C9C8C2] hover:bg-[#F8F8F5] hover:text-[#1A1A2E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C8924A]"
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
          className="flex-shrink-0 bg-white px-3 pb-3 pt-2 sm:px-5 sm:pb-4"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <div className="chat-composer mx-auto flex max-w-[720px] items-end gap-2 border border-[#D8D8D3] bg-[#FAFAF8] p-1.5 shadow-[0_2px_12px_rgba(13,21,38,0.07)] transition-[border-color,box-shadow] focus-within:border-[#B9B8B2] focus-within:bg-white focus-within:shadow-[0_3px_16px_rgba(13,21,38,0.10)]">
            <label htmlFor="mohasib-chat-input" className="sr-only">Votre message</label>
            <textarea
              id="mohasib-chat-input"
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              placeholder="Comment puis-je vous aider aujourd'hui ?"
              disabled={loading}
              rows={1}
              className="max-h-32 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2.5 py-2.5 text-[13px] leading-5 text-[#1A1A2E] outline-none placeholder:text-[#A0A5AE] disabled:bg-transparent"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="chat-send-button flex h-10 w-10 flex-shrink-0 items-center justify-center bg-[#C8924A] text-white transition-colors hover:bg-[#B8823A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D1526] disabled:cursor-not-allowed disabled:bg-[#E4D4BD]"
              aria-label="Envoyer le message"
            >
              <ArrowUp size={16} strokeWidth={2.2} />
            </button>
          </div>
          <p className="mx-auto mt-2 max-w-[720px] text-center text-[9.5px] text-[#9297A0]">
            Entrée pour envoyer · Maj + Entrée pour une nouvelle ligne
          </p>
        </form>
      </section>
    </div>
  );
}

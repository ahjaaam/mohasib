"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, Trash2, MessageSquare } from "lucide-react";
import MarkdownMessage from "@/components/MarkdownMessage";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

const SUGS = [
  "Combien je dois en TVA ce mois ?",
  "Qui ne m'a pas payé ?",
  "Mon meilleur client ?",
  "Résume ma situation financière",
  "Prochaine déclaration DGI ?",
  "Comment calculer l'IS ?",
];

const WELCOME: Message = {
  role: "assistant",
  content:
    "Bonjour 👋 Je suis Mohasib AI — votre comptable intelligent. Je connais la fiscalité marocaine, le PCGM, la TVA, l'IS et l'IR. Posez-moi n'importe quelle question.",
};

function groupByDate(conversations: Conversation[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today);
  week.setDate(week.getDate() - 7);

  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Aujourd'hui", items: [] },
    { label: "Hier", items: [] },
    { label: "7 derniers jours", items: [] },
    { label: "Plus ancien", items: [] },
  ];

  for (const c of conversations) {
    const d = new Date(c.updated_at);
    d.setHours(0, 0, 0, 0);
    if (d >= today) groups[0].items.push(c);
    else if (d >= yesterday) groups[1].items.push(c);
    else if (d >= week) groups[2].items.push(c);
    else groups[3].items.push(c);
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function ChatInterface() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/chat/history");
    const json = await res.json();
    setConversations(json.conversations ?? []);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function openConversation(id: string) {
    setActiveId(id);
    setMessages([WELCOME]);
    const res = await fetch(`/api/chat/history?id=${id}`);
    const json = await res.json();
    const msgs: Message[] = json.messages ?? [];
    setMessages([WELCOME, ...msgs]);
  }

  function newConversation() {
    setActiveId(null);
    setMessages([WELCOME]);
    setInput("");
    inputRef.current?.focus();
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/chat/history?id=${id}`, { method: "DELETE" });
    if (activeId === id) newConversation();
    setConversations((c) => c.filter((x) => x.id !== id));
  }

  async function send(content: string) {
    if (!content.trim() || loading) return;
    const userMsg: Message = { role: "user", content: content.trim() };
    const apiHistory = [...messages.slice(1), userMsg];
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);
    setMessages((p) => [...p, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiHistory, conversation_id: activeId }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.conversation_id && !activeId) {
              setActiveId(parsed.conversation_id);
            }
            if (parsed.text) {
              setMessages((p) => {
                const upd = [...p];
                upd[upd.length - 1] = {
                  role: "assistant",
                  content: upd[upd.length - 1].content + parsed.text,
                };
                return upd;
              });
            }
          } catch {}
        }
      }

      // Refresh sidebar
      loadConversations();
    } catch {
      setMessages((p) => {
        const upd = [...p];
        upd[upd.length - 1] = {
          role: "assistant",
          content: "Service momentanément indisponible. Réessayez.",
        };
        return upd;
      });
    } finally {
      setLoading(false);
    }
  }

  const groups = groupByDate(conversations);

  return (
    <div className="flex h-[calc(100vh-88px)] gap-0 -mx-[22px] -mt-[18px]">
      {/* Sidebar */}
      <div className="w-[220px] flex-shrink-0 flex flex-col border-r border-[rgba(0,0,0,0.08)] bg-white overflow-hidden">
        <div className="p-3 border-b border-[rgba(0,0,0,0.08)]">
          <button
            onClick={newConversation}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0D1526] text-white text-[12.5px] font-medium hover:bg-[#1a2740] transition-colors"
          >
            <Plus size={13} />
            Nouvelle conversation
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {conversations.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <MessageSquare size={20} className="text-[#D1D5DB] mx-auto mb-2" />
              <p className="text-[11.5px] text-[#9CA3AF]">Aucune conversation</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.6px] text-[#9CA3AF]">
                  {group.label}
                </div>
                {group.items.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => openConversation(c.id)}
                    className={`group flex items-center gap-2 px-3 py-2 mx-1.5 rounded-lg cursor-pointer transition-colors ${
                      activeId === c.id
                        ? "bg-[rgba(200,146,74,0.10)] text-[#C8924A]"
                        : "text-[#374151] hover:bg-[#F9FAFB]"
                    }`}
                  >
                    <MessageSquare size={12} className="flex-shrink-0 opacity-50" />
                    <span className="flex-1 text-[12px] truncate leading-snug">{c.title}</span>
                    <button
                      onClick={(e) => deleteConversation(c.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-[#9CA3AF] hover:text-[#DC2626] transition-all flex-shrink-0"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#FAFAF6]">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 p-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-2 max-w-[87%] ${m.role === "user" ? "self-end flex-row-reverse" : "self-start"}`}
            >
              <div
                className={`w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5 ${
                  m.role === "assistant" ? "bg-[#C8924A] text-[#0D1526]" : "bg-[#0D1526] text-[#C8924A]"
                }`}
              >
                {m.role === "assistant" ? "M" : "K"}
              </div>
              <div
                className={`px-3.5 py-2.5 text-[12.5px] leading-[1.55] ${
                  m.role === "assistant" ? "chat-bubble-ai" : "chat-bubble-user"
                }`}
              >
                {!m.content ? (
                  <div className="flex gap-1 items-center py-0.5">
                    <div className="dot" />
                    <div className="dot" />
                    <div className="dot" />
                  </div>
                ) : m.role === "assistant" ? (
                  <MarkdownMessage content={m.content} />
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Suggestion chips */}
        <div className="flex flex-wrap gap-1.5 px-4 py-2.5 border-t border-[rgba(0,0,0,0.08)] bg-white">
          {SUGS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              className="sug-chip disabled:opacity-40"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="flex gap-2 px-4 py-2.5 border-t border-[rgba(0,0,0,0.08)] bg-white">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
            placeholder="Posez votre question comptable..."
            disabled={loading}
            className="flex-1 px-3.5 py-2 border border-[rgba(0,0,0,0.14)] rounded-full text-[12.5px] outline-none bg-white transition-colors focus:border-[#C8924A] placeholder:text-[#B0B0B8]"
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-full bg-[#C8924A] flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
          >
            <Send size={14} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}

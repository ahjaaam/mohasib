"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/types";
import ClientModal from "./ClientModal";

type InvoiceRow = {
  id: string;
  total: number;
  status: string;
  issue_date: string;
  due_date: string | null;
  updated_at: string;
};

type ClientWithStats = Client & {
  _invoices: InvoiceRow[];
  _ca: number;
  _count: number;
  _avgDelay: number | null;
  _overdueCount: number;
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function fmtCA(n: number): string {
  return n.toLocaleString("fr-MA", { maximumFractionDigits: 0 }) + " MAD";
}

function calcStats(invoices: InvoiceRow[]) {
  const nonDraft = invoices.filter((i) => i.status !== "draft");
  const ca = nonDraft.reduce((sum, i) => sum + Number(i.total), 0);
  const count = invoices.length;

  // Average payment delay: use updated_at - issue_date as proxy for paid invoices
  const paid = invoices.filter((i) => i.status === "paid");
  let avgDelay: number | null = null;
  if (paid.length > 0) {
    const total = paid.reduce((sum, i) => {
      const days = Math.max(
        0,
        Math.round(
          (new Date(i.updated_at).getTime() - new Date(i.issue_date).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      );
      return sum + days;
    }, 0);
    avgDelay = Math.round(total / paid.length);
  }

  const overdueCount = invoices.filter((i) => i.status === "overdue").length;
  return { ca, count, avgDelay, overdueCount };
}

function delayColor(days: number): string {
  if (days < 30) return "text-[#059669]";
  if (days <= 45) return "text-[#D97706]";
  return "text-[#DC2626]";
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const supabase = createClient();

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await supabase
      .from("clients")
      .select(`*, invoices(id, total, status, issue_date, due_date, updated_at)`)
      .eq("user_id", user.id)
      .order("name");

    const rows: ClientWithStats[] = (data ?? []).map((c: any) => {
      const invoices: InvoiceRow[] = c.invoices ?? [];
      const { ca, count, avgDelay, overdueCount } = calcStats(invoices);
      return { ...c, _invoices: invoices, _ca: ca, _count: count, _avgDelay: avgDelay, _overdueCount: overdueCount };
    });

    setClients(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Topbar "+ Nouveau client" button dispatches this event
  useEffect(() => {
    const handler = () => {
      setEditClient(null);
      setModalOpen(true);
    };
    document.addEventListener("open-add-client", handler);
    return () => document.removeEventListener("open-add-client", handler);
  }, []);

  function openAdd() {
    setEditClient(null);
    setModalOpen(true);
  }

  function openEdit(c: Client) {
    setEditClient(c);
    setModalOpen(true);
  }

  if (loading)
    return (
      <div className="text-[12.5px] text-[#6B7280] py-8 text-center">Chargement...</div>
    );

  if (clients.length === 0)
    return (
      <>
        <ClientModal
          userId={userId}
          client={null}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={load}
        />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-3">👥</div>
          <p className="text-[#6B7280] font-medium text-[13px] mb-1">
            Aucun client pour l&apos;instant
          </p>
          <p className="text-[11.5px] text-[#9CA3AF] mb-4">
            Ajoutez vos clients pour les associer à vos factures.
          </p>
          <button onClick={openAdd} className="btn btn-gold">
            + Nouveau client
          </button>
        </div>
      </>
    );

  return (
    <>
      <ClientModal
        userId={userId}
        client={editClient}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        onDeleted={load}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {clients.map((c) => (
          <div
            key={c.id}
            onClick={() => openEdit(c)}
            className="client-card group relative cursor-pointer hover:border-[#C8924A]/40 transition-all"
          >
            {/* Overdue badge */}
            {c._overdueCount > 0 && (
              <span className="absolute top-3 right-3 text-[10px] font-semibold bg-[#FEE2E2] text-[#DC2626] px-1.5 py-0.5 rounded-full">
                {c._overdueCount} en retard
              </span>
            )}

            {/* Avatar */}
            <div className="w-9 h-9 rounded-lg bg-[#0D1526] text-[#C8924A] flex items-center justify-center font-bold text-[13px] mb-2.5 flex-shrink-0">
              {initials(c.name)}
            </div>

            <div className="text-[13px] font-semibold text-[#1A1A2E] mb-0.5 pr-16">{c.name}</div>
            {c.ice && <div className="text-[11px] text-[#6B7280]">ICE: {c.ice}</div>}
            {c.city && <div className="text-[11px] text-[#6B7280]">{c.city}</div>}
            {c.email && <div className="text-[11px] text-[#6B7280]">{c.email}</div>}
            {c.phone && <div className="text-[11px] text-[#6B7280]">{c.phone}</div>}

            {/* Stats */}
            <div className="flex gap-4 mt-2.5 pt-2.5 border-t border-[rgba(0,0,0,0.08)]">
              <div className="text-[11px] text-[#6B7280]">
                <strong className="block text-[12px] text-[#1A1A2E] font-semibold">
                  {fmtCA(c._ca)}
                </strong>
                CA total
              </div>
              <div className="text-[11px] text-[#6B7280]">
                <strong className="block text-[12px] text-[#1A1A2E] font-semibold">
                  {c._count}
                </strong>
                Factures
              </div>
              <div className="text-[11px] text-[#6B7280]">
                <strong
                  className={`block text-[12px] font-semibold ${
                    c._avgDelay !== null ? delayColor(c._avgDelay) : "text-[#1A1A2E]"
                  }`}
                >
                  {c._avgDelay !== null ? `${c._avgDelay}j` : "—"}
                </strong>
                Délai moyen
              </div>
            </div>

            {/* Hover hint */}
            <div className="absolute bottom-3 right-3 text-[10.5px] text-[#C8924A] font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              Modifier →
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

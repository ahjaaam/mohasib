"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Client } from "@/types";
import AddClientModal from "./AddClientModal";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string>("");
  const supabase = createClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("user_id", user.id)
      .order("name");
    setClients(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  // Listen for open-add-client event from topbar
  useEffect(() => {
    const handler = () => document.getElementById("add-client-btn")?.click();
    document.addEventListener("open-add-client", handler);
    return () => document.removeEventListener("open-add-client", handler);
  }, []);

  if (loading) return <div className="text-[12.5px] text-[#6B7280] py-8 text-center">Chargement...</div>;

  if (clients.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-4xl mb-3">👥</div>
      <p className="text-[#6B7280] font-medium text-[13px] mb-1">Aucun client pour l&apos;instant</p>
      <p className="text-[11.5px] text-[#9CA3AF] mb-4">Ajoutez vos clients pour les associer à vos factures.</p>
      {userId && <AddClientModal userId={userId} onCreated={load} buttonId="add-client-btn" />}
    </div>
  );

  return (
    <div>
      {userId && <div className="hidden"><AddClientModal userId={userId} onCreated={load} buttonId="add-client-btn" /></div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {clients.map((c) => (
          <div key={c.id} className="client-card">
            {/* Avatar */}
            <div className="w-9 h-9 rounded-lg bg-[#0D1526] text-[#C8924A] flex items-center justify-center font-bold text-[13px] mb-2.5">
              {initials(c.name)}
            </div>
            <div className="text-[13px] font-semibold text-[#1A1A2E] mb-0.5">{c.name}</div>
            {c.ice && <div className="text-[11px] text-[#6B7280]">ICE: {c.ice}</div>}
            {c.city && <div className="text-[11px] text-[#6B7280]">{c.city}</div>}
            {c.email && <div className="text-[11px] text-[#6B7280]">{c.email}</div>}
            {c.phone && <div className="text-[11px] text-[#6B7280]">{c.phone}</div>}

            {/* Stats */}
            <div className="flex gap-3 mt-2.5 pt-2.5 border-t border-[rgba(0,0,0,0.08)]">
              <div className="text-[11px] text-[#6B7280]">
                <strong className="block text-[12.5px] text-[#1A1A2E] font-semibold">—</strong>
                CA total
              </div>
              <div className="text-[11px] text-[#6B7280]">
                <strong className="block text-[12.5px] text-[#1A1A2E] font-semibold">0</strong>
                Factures
              </div>
              {c.notes && (
                <div className="text-[11px] text-[#6B7280] truncate">
                  <strong className="block text-[12.5px] text-[#1A1A2E] font-semibold truncate">Note</strong>
                  {c.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

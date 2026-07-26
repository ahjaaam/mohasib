"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { createClient } from "@/lib/supabase/client";

export default function WaitlistClient() {
  const supabase = createClient();
  const [track, setTrack] = useState<"entrepreneur" | "comptable">("entrepreneur");
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [saving, setSaving] = useState(false);
  const [position, setPosition] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Email requis");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("fiduciaire_waitlist").insert({
      nom: nom.trim() || null,
      email: email.trim(),
      telephone: telephone.trim() || null,
      track,
      source: "liste-attente",
    });
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    const { count } = await supabase
      .from("fiduciaire_waitlist")
      .select("id", { count: "exact", head: true });
    setPosition(count ?? null);
    setSaving(false);
    toast.success("Inscription enregistrée");
  }

  return (
    <form onSubmit={submit} className="public-surface public-accent-surface p-6">
      <div className="mb-5 grid grid-cols-2 gap-2 border border-[#E2E1DB] bg-[#F3F4F6] p-1">
        {(["entrepreneur", "comptable"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTrack(item)}
            className={`rounded-full px-4 py-2 text-[13px] font-bold ${track === item ? "bg-[#0D1526] text-white" : "text-[#6B7280]"}`}
          >
            {item === "entrepreneur" ? "Entrepreneur" : "Comptable"}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        <input className="input w-full" placeholder="Prénom et nom" value={nom} onChange={(e) => setNom(e.target.value)} />
        <input className="input w-full" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div className="flex">
          <span className="inline-flex items-center rounded-l-lg border border-r-0 border-[rgba(0,0,0,0.12)] bg-[#FAFAF6] px-3 text-[13px] text-[#6B7280]">+212</span>
          <input className="input w-full rounded-l-none" placeholder="Téléphone" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
        </div>
      </div>
      <button disabled={saving} className="public-primary-action mt-5 w-full disabled:opacity-60">
        {saving ? "Inscription..." : "Rejoindre la liste"}
      </button>
      {position !== null && (
        <p className="mt-4 rounded-xl bg-[#ECFDF5] px-4 py-3 text-center text-[13px] font-bold text-[#065F46]">
          Votre position estimée : #{position}
        </p>
      )}
    </form>
  );
}

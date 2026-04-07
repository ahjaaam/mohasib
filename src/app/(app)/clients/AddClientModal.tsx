"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, UserPlus } from "lucide-react";

interface Props {
  userId: string;
  className?: string;
  onCreated?: () => void | Promise<void>;
  buttonId?: string;
}

export default function AddClientModal({ userId, className = "", onCreated, buttonId }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", city: "", ice: "", rc: "", notes: "",
  });

  function reset() {
    setForm({ name: "", email: "", phone: "", address: "", city: "", ice: "", rc: "", notes: "" });
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const { error: err } = await supabase.from("clients").insert({
      user_id: userId,
      ...form,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      city: form.city || null,
      ice: form.ice || null,
      rc: form.rc || null,
      notes: form.notes || null,
    });

    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      setOpen(false);
      reset();
      await onCreated?.();
    }
  }

  return (
    <>
      <button id={buttonId} onClick={() => setOpen(true)} className={`btn btn-gold ${className}`}>
        <UserPlus size={14} />
        Nouveau client
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(13,21,38,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.08)]">
              <h2 className="text-[14px] font-semibold text-[#1A1A2E]">Nouveau client</h2>
              <button onClick={() => { setOpen(false); reset(); }}
                className="text-[#6B7280] hover:text-[#1A1A2E] transition-colors">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#6B7280]">Nom / Raison sociale *</label>
                <input className="input" required value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-[#6B7280]">Email</label>
                  <input type="email" className="input" value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-[#6B7280]">Téléphone</label>
                  <input className="input" value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#6B7280]">Adresse</label>
                <input className="input" value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#6B7280]">Ville</label>
                <input className="input" value={form.city}
                  onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-[#6B7280]">ICE</label>
                  <input className="input font-mono" placeholder="000 000 000 00000" value={form.ice}
                    onChange={(e) => setForm((f) => ({ ...f, ice: e.target.value }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-medium text-[#6B7280]">RC</label>
                  <input className="input font-mono" value={form.rc}
                    onChange={(e) => setForm((f) => ({ ...f, rc: e.target.value }))} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-[#6B7280]">Notes</label>
                <textarea className="input min-h-[60px] resize-none" value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>

              {error && <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setOpen(false); reset(); }}
                  className="btn btn-outline flex-1 justify-center">Annuler</button>
                <button type="submit" disabled={saving} className="btn btn-gold flex-1 justify-center">
                  {saving ? "Enregistrement..." : "Créer le client"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

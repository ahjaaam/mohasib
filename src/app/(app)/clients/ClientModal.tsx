"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";
import type { Client } from "@/types";

interface Props {
  userId: string;
  client?: Client | null;  // null/undefined = add mode, Client = edit mode
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  whatsapp: "",
  address: "",
  city: "",
  postal_code: "",
  country: "Maroc",
  ice: "",
  if_number: "",
  rc: "",
  notes: "",
};

type FormState = typeof EMPTY_FORM;

export default function ClientModal({ userId, client, open, onClose, onSaved, onDeleted }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const supabase = createClient();

  const isEdit = !!client;

  // Sync form when client changes or modal opens
  useEffect(() => {
    if (open) {
      if (client) {
        setForm({
          name: client.name ?? "",
          email: client.email ?? "",
          phone: client.phone ?? "",
          whatsapp: client.whatsapp ?? "",
          address: client.address ?? "",
          city: client.city ?? "",
          postal_code: client.postal_code ?? "",
          country: client.country ?? "Maroc",
          ice: client.ice ?? "",
          if_number: client.if_number ?? "",
          rc: client.rc ?? "",
          notes: client.notes ?? "",
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setError(null);
      setConfirmDelete(false);
    }
  }, [open, client]);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      user_id: userId,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      postal_code: form.postal_code.trim() || null,
      country: form.country.trim() || null,
      ice: form.ice.trim() || null,
      if_number: form.if_number.trim() || null,
      rc: form.rc.trim() || null,
      notes: form.notes.trim() || null,
    };

    let err;
    if (isEdit) {
      ({ error: err } = await supabase
        .from("clients")
        .update(payload)
        .eq("id", client.id));
    } else {
      ({ error: err } = await supabase.from("clients").insert(payload));
    }

    setSaving(false);
    if (err) {
      setError(err.message);
    } else {
      onClose();
      await onSaved();
    }
  }

  async function handleDelete() {
    if (!client) return;
    setDeleting(true);
    await supabase.from("clients").delete().eq("id", client.id);
    setDeleting(false);
    onClose();
    onDeleted?.();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(13,21,38,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(0,0,0,0.08)] sticky top-0 bg-white z-10">
          <h2 className="text-[14px] font-semibold text-[#1A1A2E]">
            {isEdit ? "Modifier le client" : "Nouveau client"}
          </h2>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#1A1A2E] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Confirm delete overlay */}
        {confirmDelete && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl"
            style={{ backgroundColor: "rgba(255,255,255,0.95)" }}>
            <div className="p-6 text-center max-w-xs">
              <div className="text-[22px] mb-2">⚠️</div>
              <p className="text-[13px] font-semibold text-[#1A1A2E] mb-1">
                Supprimer {client?.name} ?
              </p>
              <p className="text-[11.5px] text-[#6B7280] mb-5">
                Cette action est irréversible.
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="btn btn-outline"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn bg-[#DC2626] text-white hover:bg-[#B91C1C] border-0"
                >
                  {deleting ? "Suppression..." : "Supprimer"}
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Nom / Raison sociale *</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          {/* ICE + IF */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#6B7280]">ICE</label>
              <input
                className="input font-mono"
                placeholder="000000000000000"
                maxLength={15}
                value={form.ice}
                onChange={(e) => set("ice", e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#6B7280]">IF</label>
              <input
                className="input font-mono"
                value={form.if_number}
                onChange={(e) => set("if_number", e.target.value)}
              />
            </div>
          </div>

          {/* RC */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">RC</label>
            <input
              className="input font-mono"
              value={form.rc}
              onChange={(e) => set("rc", e.target.value)}
            />
          </div>

          {/* Address */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Adresse complète</label>
            <input
              className="input"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>

          {/* City + Postal code */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#6B7280]">Ville *</label>
              <input
                className="input"
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#6B7280]">Code postal</label>
              <input
                className="input"
                value={form.postal_code}
                onChange={(e) => set("postal_code", e.target.value)}
              />
            </div>
          </div>

          {/* Country */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Pays</label>
            <input
              className="input"
              value={form.country}
              onChange={(e) => set("country", e.target.value)}
            />
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#6B7280]">Email</label>
              <input
                type="email"
                className="input"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-[#6B7280]">Téléphone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">WhatsApp</label>
            <input
              className="input"
              placeholder="+212 6XX XXX XXX"
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Notes</label>
            <textarea
              className="input min-h-[72px] resize-none"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          {error && (
            <p className="text-[12px] text-[#DC2626] bg-[#FEE2E2] px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-outline flex-1 justify-center">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="btn btn-gold flex-1 justify-center">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>

          {/* Delete link */}
          {isEdit && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-[11.5px] text-[#DC2626] hover:underline transition-colors"
              >
                Supprimer ce client
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

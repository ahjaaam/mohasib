"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { PASSWORD_REQUIREMENTS, validatePassword } from "@/lib/password-policy";
import { translateError } from "@/lib/errors";
import { Camera } from "lucide-react";

interface Props {
  userId: string;
  userEmail: string;
  profile: any;
  prefs: any;
}

const LANGUAGES = [{ value: "fr", label: "Français" }, { value: "ar", label: "العربية" }];
const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY"];

export default function ProfilTab({ userId, userEmail, profile, prefs }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const avatarRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fullName: string = profile?.full_name ?? "";
  const nameParts = fullName.split(" ");
  const [form, setForm] = useState({
    prenom: nameParts[0] ?? "",
    nom: nameParts.slice(1).join(" ") ?? "",
    phone: profile?.phone ?? "",
    role: profile?.role ?? "",
    avatar_url: profile?.avatar_url ?? "",
  });

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });

  const [notifs, setNotifs] = useState({
    notif_tva_email: prefs?.notif_tva_email ?? true,
    notif_overdue_email: prefs?.notif_overdue_email ?? true,
    notif_weekly_summary: prefs?.notif_weekly_summary ?? true,
    notif_whatsapp: prefs?.notif_whatsapp ?? false,
  });

  const [locale, setLocale] = useState({
    language: prefs?.language ?? "fr",
    timezone: prefs?.timezone ?? "Africa/Casablanca",
    date_format: prefs?.date_format ?? "DD/MM/YYYY",
  });

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Initials for avatar placeholder
  const initials = form.prenom
    ? (form.prenom[0] + (form.nom[0] ?? "")).toUpperCase()
    : userEmail.slice(0, 2).toUpperCase();

  async function uploadAvatar(file: File) {
    if (file.size > 1024 * 1024) { toast.error("Image trop lourde (max 1MB)"); return; }
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
    };
    const ext = extensions[file.type];
    if (!ext) { toast.error("Format non pris en charge (JPG ou PNG)"); return; }

    setUploading(true);
    const path = `${userId}/avatar.${ext}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: profileError } = await supabase
        .from("users")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (profileError) throw profileError;

      set("avatar_url", publicUrl);
      router.refresh();
      toast.success("Avatar mis à jour");
    } catch (error) {
      console.error("Avatar upload failed:", error);
      toast.error(translateError(error));
    } finally {
      setUploading(false);
      if (avatarRef.current) avatarRef.current.value = "";
    }
  }

  async function saveProfil() {
    setSaving(true);
    try {
      const full_name = `${form.prenom} ${form.nom}`.trim();
      const { error: profileError } = await supabase
        .from("users")
        .update({ full_name, phone: form.phone, role: form.role })
        .eq("id", userId);
      if (profileError) throw profileError;

      const { error: preferencesError } = await supabase.from("user_preferences").upsert({
        user_id: userId,
        ...notifs,
        ...locale,
      }, { onConflict: "user_id" });
      if (preferencesError) throw preferencesError;

      router.refresh();
      toast.success("Profil enregistré");
    } catch (error) {
      console.error("Profile save failed:", error);
      toast.error(translateError(error));
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    const passwordError = validatePassword(pwd.next);
    if (passwordError) { toast.error(passwordError); return; }
    if (pwd.next !== pwd.confirm) { toast.error("Les mots de passe ne correspondent pas"); return; }
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: pwd.next });
    setSavingPwd(false);
    if (error) toast.error(translateError(error));
    else { toast.success("Mot de passe modifié"); setPwd({ current: "", next: "", confirm: "" }); }
  }

  const Toggle = ({ value, onChange, label, sub }: { value: boolean; onChange: () => void; label: string; sub?: string }) => (
    <div className="flex items-center justify-between py-2 border-b border-[rgba(0,0,0,0.05)] last:border-0">
      <div>
        <div className="text-[12.5px] text-[#1A1A2E]">{label}</div>
        {sub && <div className="text-[11px] text-[#9CA3AF]">{sub}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={onChange}
        className={`w-10 h-5 rounded-full transition-colors relative flex-shrink-0 ${value ? "bg-[#C8924A]" : "bg-[#D1D5DB]"}`}
      >
        <span className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Avatar */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-3">Photo de profil</h3>
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="Avatar" className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#C8924A] flex items-center justify-center text-[22px] font-bold text-[#0D1526]">
                {initials}
              </div>
            )}
            <button
              onClick={() => avatarRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-[rgba(0,0,0,0.14)] flex items-center justify-center hover:bg-[#F0EDE5] transition-colors"
            >
              <Camera size={12} className="text-[#6B7280]" />
            </button>
          </div>
          <div>
            <p className="text-[12px] text-[#6B7280]">JPG, PNG — max 1MB</p>
            <button onClick={() => avatarRef.current?.click()} disabled={uploading} className="btn btn-outline btn-sm mt-1.5">
              {uploading ? "Téléchargement..." : "Changer la photo"}
            </button>
          </div>
        </div>
        <input ref={avatarRef} type="file" accept="image/jpeg,image/png" className="hidden"
          onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
      </div>

      {/* Personal Info */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Informations personnelles</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Prénom *</label>
            <input className="input" value={form.prenom} onChange={e => set("prenom", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Nom *</label>
            <input className="input" value={form.nom} onChange={e => set("nom", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Email</label>
            <input className="input bg-[#FAFAF6] cursor-not-allowed" value={userEmail} readOnly />
            <span className="text-[10.5px] text-[#9CA3AF]">Pour changer votre email, contactez le support.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Téléphone personnel</label>
            <input className="input" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+212 6XX XXX XXX" />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[11px] font-medium text-[#6B7280]">Poste / Rôle</label>
            <input className="input" value={form.role} onChange={e => set("role", e.target.value)} placeholder="Gérant, Comptable..." />
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Changer le mot de passe</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[11px] font-medium text-[#6B7280]">Nouveau mot de passe</label>
            <input type="password" className="input" value={pwd.next} onChange={e => setPwd(p => ({ ...p, next: e.target.value }))} placeholder={PASSWORD_REQUIREMENTS} />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <label className="text-[11px] font-medium text-[#6B7280]">Confirmer le nouveau mot de passe</label>
            <input type="password" className="input" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} />
          </div>
        </div>
        <button onClick={changePassword} disabled={savingPwd || !pwd.next} className="btn btn-gold mt-3 disabled:opacity-60">
          {savingPwd ? "..." : "Changer le mot de passe"}
        </button>
      </div>

      {/* Notifications */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-3">Préférences de notifications</h3>
        <Toggle value={notifs.notif_tva_email} onChange={() => setNotifs(n => ({ ...n, notif_tva_email: !n.notif_tva_email }))}
          label="Rappels de déclarations TVA par email" />
        <Toggle value={notifs.notif_overdue_email} onChange={() => setNotifs(n => ({ ...n, notif_overdue_email: !n.notif_overdue_email }))}
          label="Alertes factures en retard par email" />
        <Toggle value={notifs.notif_weekly_summary} onChange={() => setNotifs(n => ({ ...n, notif_weekly_summary: !n.notif_weekly_summary }))}
          label="Résumé financier hebdomadaire" />
        <Toggle value={notifs.notif_whatsapp} onChange={() => setNotifs(n => ({ ...n, notif_whatsapp: !n.notif_whatsapp }))}
          label="Notifications WhatsApp" sub="Nécessite un numéro WhatsApp configuré" />
      </div>

      {/* Language & Region */}
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-[13px] font-semibold text-[#1A1A2E] mb-4">Langue et région</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Langue de l&apos;interface</label>
            <select className="input" value={locale.language} onChange={e => setLocale(l => ({ ...l, language: e.target.value }))}>
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Fuseau horaire</label>
            <select className="input" value={locale.timezone} onChange={e => setLocale(l => ({ ...l, timezone: e.target.value }))}>
              <option value="Africa/Casablanca">Africa/Casablanca (UTC+1)</option>
              <option value="Europe/Paris">Europe/Paris (UTC+2)</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Format de date</label>
            <select className="input" value={locale.date_format} onChange={e => setLocale(l => ({ ...l, date_format: e.target.value }))}>
              {DATE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-[#6B7280]">Devise</label>
            <input className="input bg-[#FAFAF6] cursor-not-allowed" value="MAD — Dirham marocain" readOnly />
          </div>
        </div>
      </div>

      <button onClick={saveProfil} disabled={saving} className="btn btn-gold w-full justify-center py-2.5 disabled:opacity-60">
        {saving ? "Enregistrement..." : "Enregistrer le profil"}
      </button>
    </div>
  );
}

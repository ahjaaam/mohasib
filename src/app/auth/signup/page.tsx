"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { translateError } from "@/lib/errors";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, CheckCircle, Building2, Briefcase } from "lucide-react";

type UserType = "entrepreneur" | "fiduciaire";

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [userType, setUserType] = useState<UserType>("entrepreneur");
  const [form, setForm] = useState({ full_name: "", company: "", email: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invitation");
    if (!token) return;
    setInvitationToken(token);
    fetch(`/api/invitations/${token}`)
      .then(response => response.json())
      .then(data => {
        if (!data.email) return;
        setUserType(data.track === "comptable" ? "fiduciaire" : "entrepreneur");
        setForm(current => ({ ...current, email: data.email, company: "" }));
        setStep(2);
      });
  }, []);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (invitationToken) {
      const response = await fetch(`/api/invitations/${invitationToken}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: form.full_name, password: form.password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setLoading(false);
        setError(result.message || "Impossible de créer le compte Responsable.");
        return;
      }
      const signedIn = await supabase.auth.signInWithPassword({ email: result.email, password: form.password });
      setLoading(false);
      if (signedIn.error) {
        setError("Compte créé. Connectez-vous avec votre adresse e-mail et votre mot de passe.");
        return;
      }
      window.location.href = result.redirect;
      return;
    }

    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          company: form.company,
          user_type: userType,
          invitation_token: invitationToken,
        },
      },
    });

    setLoading(false);
    if (err) {
      setError(translateError(err));
    } else {
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#FAFAF6" }}>
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-navy mb-2">Compte créé !</h1>
          <p className="text-sm text-gray-500 mb-5">
            Vérifiez votre boîte mail et cliquez sur le lien de confirmation pour activer votre compte.
          </p>
          <Link href="/connexion"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: "#C8924A" }}>
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#FAFAF6" }}>
          <div className="w-full max-w-sm">
            <div className="mb-8">
              <Image src="/logo2.png" alt="Mohasib" width={140} height={42} style={{ objectFit: "contain", height: "auto" }} />
            </div>

            <h1 className="text-2xl font-bold text-navy mb-1">Je suis...</h1>
            <p className="text-sm text-gray-500 mb-7">
              Déjà inscrit ?{" "}
              <Link href="/connexion" className="text-gold hover:underline font-medium">Se connecter</Link>
            </p>

            <div className="space-y-3 mb-7">
              <button
                onClick={() => { setUserType("entrepreneur"); setStep(2); }}
                className="w-full p-4 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: "rgba(0,0,0,0.1)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  backgroundColor: "white",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#C8924A")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)")}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[rgba(200,146,74,0.12)] flex items-center justify-center flex-shrink-0">
                    <Briefcase size={18} className="text-[#C8924A]" />
                  </div>
                  <div>
                    <div className="font-semibold text-[#1A1A2E] text-[14px]">Un entrepreneur / freelance</div>
                    <div className="text-[12px] text-[#6B7280] mt-0.5">Gérez votre propre comptabilité</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => { setUserType("fiduciaire"); setStep(2); }}
                className="w-full p-4 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: "rgba(0,0,0,0.1)",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  backgroundColor: "white",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#C8924A")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)")}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[rgba(13,21,38,0.06)] flex items-center justify-center flex-shrink-0">
                    <Building2 size={18} className="text-[#0D1526]" />
                  </div>
                  <div>
                    <div className="font-semibold text-[#1A1A2E] text-[14px]">Un comptable / Expert-comptable</div>
                    <div className="text-[12px] text-[#6B7280] mt-0.5">Gérez plusieurs dossiers clients</div>
                  </div>
                  <span className="ml-auto flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#0D1526] text-white">
                    Nouveau
                  </span>
                </div>
              </button>
            </div>
          </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: "#FAFAF6" }}>
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <Image src="/logo2.png" alt="Mohasib" width={140} height={42} style={{ objectFit: "contain", height: "auto" }} />
          </div>

          {!invitationToken && <button
            onClick={() => setStep(1)}
            className="flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#1A1A2E] mb-5 transition-colors"
          >
            ← {userType === "fiduciaire" ? "Comptable Pro" : "Entrepreneur / freelance"}
          </button>}

          <h1 className="text-2xl font-bold text-navy mb-1">Créer un compte</h1>
          <p className="text-sm text-gray-500 mb-7">
            Déjà inscrit ?{" "}
            <Link href="/connexion" className="text-gold hover:underline font-medium">Se connecter</Link>
          </p>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="label">Nom complet</label>
              <input className="input" placeholder="Prénom Nom" required
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            {!invitationToken && <div>
              <label className="label">
                {userType === "fiduciaire" ? "Nom du cabinet" : "Entreprise"}
              </label>
              <input className="input"
                placeholder={userType === "fiduciaire" ? "Cabinet Dupont & Associés" : "Ma Société SARL"}
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
            </div>}
            <div>
              <label className="label">Adresse e-mail</label>
              <input type="email" className="input" placeholder="vous@exemple.ma" required readOnly={!!invitationToken}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Mot de passe</label>
              <div className="relative">
                <input type={showPwd ? "text" : "password"} className="input pr-10"
                  placeholder="Minimum 8 caractères" required minLength={8}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg font-medium text-sm text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: "#C8924A" }}>
              {loading ? "Création en cours..." : invitationToken ? "Créer mon accès Responsable" : "Créer mon compte"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              En créant un compte, vous acceptez nos{" "}
              <span className="text-gold cursor-pointer hover:underline">Conditions d&apos;utilisation</span>
            </p>
          </form>
        </div>
    </div>
  );
}

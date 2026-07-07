"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { translateError } from "@/lib/errors";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, CheckCircle, Building2, Briefcase } from "lucide-react";
import { PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS, validatePassword } from "@/lib/password-policy";

type UserType = "entrepreneur" | "fiduciaire";

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [userType, setUserType] = useState<UserType>("entrepreneur");
  const [form, setForm] = useState({ full_name: "", company: "", phone: "", email: "", password: "" });
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
    const passwordError = validatePassword(form.password);
    if (passwordError) {
      setLoading(false);
      setError(passwordError);
      return;
    }
    if (!form.phone.trim()) {
      setLoading(false);
      setError("Le numéro de téléphone est obligatoire.");
      return;
    }

    if (invitationToken) {
      const response = await fetch(`/api/invitations/${invitationToken}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: form.full_name, phone: form.phone, password: form.password }),
      });
      const result = await response.json();
      if (!response.ok) {
        setLoading(false);
        setError(result.message || "Impossible de créer le compte Collaborateur.");
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

    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: form.full_name,
        company: form.company,
        phone: form.phone,
        email: form.email,
        password: form.password,
        user_type: userType,
      }),
    });
    const result = await response.json();

    setLoading(false);
    if (!response.ok) {
      setError(result.code === "email_exists" ? result.error : translateError(result));
      return;
    }
    if (result.hasSession) {
      window.location.href = result.redirect ?? (userType === "fiduciaire" ? "/comptable-pro" : "/tableau-de-bord");
      return;
    }
    setSuccess(true);
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
            Vérifiez votre boîte mail et cliquez sur le lien de confirmation pour accéder à votre compte.
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
              <label htmlFor="signup-full-name" className="label">Nom complet</label>
              <input id="signup-full-name" className="input" placeholder="Prénom Nom" required
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            {!invitationToken && <div>
              <label htmlFor="signup-company" className="label">
                {userType === "fiduciaire" ? "Nom du cabinet" : "Entreprise"}
              </label>
              <input id="signup-company" className="input"
                placeholder={userType === "fiduciaire" ? "Cabinet Dupont & Associés" : "Ma Société SARL"}
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
            </div>}
            <div>
              <label htmlFor="signup-phone" className="label">Numéro de téléphone</label>
              <input id="signup-phone" type="tel" className="input" placeholder="+212 6 12 34 56 78" required
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="signup-email" className="label">Adresse e-mail</label>
              <input id="signup-email" type="email" className="input" placeholder="vous@exemple.ma" required readOnly={!!invitationToken}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="signup-password" className="label">Mot de passe</label>
              <div className="relative">
                <input id="signup-password" type={showPwd ? "text" : "password"} className="input pr-10"
                  placeholder={PASSWORD_REQUIREMENTS} required minLength={PASSWORD_MIN_LENGTH}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
                <button type="button"
                  aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                <p>{error}</p>
                {error.startsWith("Un compte existe déjà") && (
                  <div className="flex gap-3 mt-2 font-semibold">
                    <Link href="/connexion" className="hover:underline">Se connecter</Link>
                    <Link href="/mot-de-passe-oublie" className="hover:underline">Mot de passe oublié</Link>
                  </div>
                )}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg font-medium text-sm text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: "#C8924A" }}>
              {loading ? "Création en cours..." : invitationToken ? "Créer mon accès Collaborateur" : "Créer mon compte"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              En créant un compte, vous acceptez nos{" "}
              <Link href="/cgu" className="text-gold hover:underline">CGU</Link>
              {" "}et notre{" "}
              <Link href="/confidentialite" className="text-gold hover:underline">Politique de Confidentialité</Link>
            </p>
          </form>
        </div>
    </div>
  );
}

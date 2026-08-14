"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { translateError } from "@/lib/errors";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, CheckCircle, Building2, Briefcase, ReceiptText } from "lucide-react";
import { PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENTS, validatePassword } from "@/lib/password-policy";
import { INVOICING_URL, appUrl, marketingUrl } from "@/lib/public-urls";

type UserType = "entrepreneur" | "fiduciaire";
type AccountMode = "full" | "invoicing";

const NEED_OPTIONS = [
  "Facturation et devis",
  "Achats et OCR",
  "TVA et déclarations",
  "Suivi des échéances",
  "Transactions et rapprochement",
  "Écritures automatiques",
  "Paie",
  "Archivage et exports",
];

export default function SignupPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [userType, setUserType] = useState<UserType>("entrepreneur");
  const [accountMode, setAccountMode] = useState<AccountMode>("full");
  const [form, setForm] = useState({
    full_name: "",
    company: "",
    phone: "",
    email: "",
    password: "",
    role: "",
    organization_size: "",
    monthly_volume: "",
    needs: [] as string[],
    other_need: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [invitationToken, setInvitationToken] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const token = searchParams.get("invitation");
    const isInvoicingDomain = window.location.host === new URL(INVOICING_URL).host;
    if (!token && (isInvoicingDomain || searchParams.get("mode") === "invoicing")) {
      setUserType("entrepreneur");
      setAccountMode("invoicing");
      setForm((current) => ({
        ...current,
        role: "Entrepreneur / indépendant",
        organization_size: "1",
        monthly_volume: "Moins de 20",
        needs: ["Facturation et devis"],
        other_need: "",
      }));
      setStep(2);
      return;
    }
    if (!token) return;
    setInvitationToken(token);
    fetch(`/api/invitations/${token}`)
      .then(response => response.json())
      .then(data => {
        if (!data.email) return;
        setUserType(data.track === "comptable" ? "fiduciaire" : "entrepreneur");
        setAccountMode("full");
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
    if (form.password !== confirmPassword) {
      setLoading(false);
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!form.phone.trim()) {
      setLoading(false);
      setError("Le numéro de téléphone est obligatoire.");
      return;
    }
    if (!invitationToken && accountMode === "full" && (!form.role || !form.organization_size || !form.monthly_volume || form.needs.length === 0)) {
      setLoading(false);
      setError("Complétez les informations sur votre activité et sélectionnez au moins un besoin.");
      return;
    }
    if (!invitationToken && form.needs.includes("Autre") && !form.other_need.trim()) {
      setLoading(false);
      setError("Précisez votre autre besoin.");
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

    const email = form.email.trim().toLowerCase();
    const { data, error: err } = await supabase.auth.signUp({
      email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          full_name: form.full_name,
          company: form.company,
          phone: form.phone.trim(),
          user_type: userType,
          account_mode: accountMode,
          requested_plan: accountMode === "invoicing" ? "free" : "trial",
          role: form.role,
          organization_size: form.organization_size,
          monthly_volume: form.monthly_volume,
          needs: form.needs,
          other_need: form.other_need.trim(),
          invitation_token: invitationToken,
        },
      },
    });

    setLoading(false);
    if (err) {
      setError(translateError(err));
    } else if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError("Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou réinitialisez votre mot de passe.");
    } else {
      if (data.session) {
        await supabase.auth.signOut();
        window.location.href = "/en-attente";
        return;
      }
      setSuccess(true);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8" style={{ backgroundColor: "#FAFAF6" }}>
        <div className="w-full max-w-sm text-center sm:rounded-2xl sm:border sm:border-black/10 sm:bg-white sm:p-10 sm:shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-xl font-bold text-navy mb-2">Compte créé !</h1>
          <p className="text-sm text-gray-500 mb-5">
            Vérifiez votre boîte mail et cliquez sur le lien de confirmation. Nous examinerons ensuite votre demande et vous contacterons très bientôt.
          </p>
          <Link href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: "#C8924A" }}>
            Retour au site
          </Link>
        </div>

        <div className="mt-6 w-full max-w-sm text-center">
          <div className="flex justify-center gap-4 text-xs text-gray-400">
            <Link href="/cgu" className="hover:underline">CGU</Link>
            <Link href="/confidentialite" className="hover:underline">Confidentialité</Link>
          </div>
          <p className="mt-2 text-[11px] text-gray-300">© 2026 Mohasib AI</p>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8" style={{ backgroundColor: "#FAFAF6" }}>
          <div className="w-full max-w-xl sm:rounded-2xl sm:border sm:border-black/10 sm:bg-white sm:p-10 sm:shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
            <a href={marketingUrl("/")} className="mb-8 inline-block">
              <Image src="/logo2.png" alt="Mohasib" width={140} height={42} style={{ objectFit: "contain", height: "auto" }} />
            </a>

            <h1 className="text-2xl font-bold text-navy mb-1">Choisissez votre type de compte</h1>
            <p className="text-sm text-gray-500 mb-7">
              Déjà inscrit ?{" "}
              <Link href={appUrl("/connexion")} className="text-gold hover:underline font-medium">Se connecter</Link>
            </p>

            <div className="mb-7">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#6B7280]">Comptes principaux</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => {
                    setUserType("entrepreneur");
                    setAccountMode("full");
                    setForm((current) => ({ ...current, role: "", organization_size: "", monthly_volume: "", needs: [], other_need: "" }));
                    setStep(2);
                  }}
                  className="h-full w-full rounded-xl border-2 border-black/10 bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-0.5 hover:border-[#C8924A]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(200,146,74,0.12)]">
                      <Briefcase size={18} className="text-[#C8924A]" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#1A1A2E]">TPME</div>
                      <div className="mt-0.5 text-[12px] text-[#6B7280]">Comptabilité, TVA, paie et automatisations pour votre entreprise</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setUserType("fiduciaire");
                    setAccountMode("full");
                    setForm((current) => ({ ...current, role: "", organization_size: "", monthly_volume: "", needs: [], other_need: "" }));
                    setStep(2);
                  }}
                  className="h-full w-full rounded-xl border-2 border-black/10 bg-white p-4 text-left shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-0.5 hover:border-[#C8924A]"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(13,21,38,0.06)]">
                      <Building2 size={18} className="text-[#0D1526]" />
                    </div>
                    <div>
                      <div className="text-[14px] font-semibold text-[#1A1A2E]">Cabinet comptable</div>
                      <div className="mt-0.5 text-[12px] text-[#6B7280]">Pilotez votre cabinet et gérez plusieurs dossiers clients</div>
                    </div>
                  </div>
                </button>
              </div>

              <div className="mt-5 border-t border-black/10 pt-5">
                <p className="mb-2 text-[12px] text-[#6B7280]">Vous avez seulement besoin de créer des factures ?</p>
                <button
                  onClick={() => {
                    setUserType("entrepreneur");
                    setAccountMode("invoicing");
                    setForm((current) => ({
                      ...current,
                      role: "Entrepreneur / indépendant",
                      organization_size: "1",
                      monthly_volume: "Moins de 20",
                      needs: ["Facturation et devis"],
                      other_need: "",
                    }));
                    setStep(2);
                  }}
                  className="w-full rounded-lg border border-black/10 bg-[#FAFAF6] p-3 text-left transition-colors hover:border-black/20 hover:bg-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-black/[0.04]">
                      <ReceiptText size={17} className="text-[#6B7280]" />
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#374151]">Facturation gratuite</div>
                      <div className="text-[11px] text-[#6B7280]">Factures et clients, sans limite de durée</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 w-full max-w-xl text-center">
            <div className="flex justify-center gap-4 text-xs text-gray-400">
              <Link href="/cgu" className="hover:underline">CGU</Link>
              <Link href="/confidentialite" className="hover:underline">Confidentialité</Link>
            </div>
            <p className="mt-2 text-[11px] text-gray-300">© 2026 Mohasib AI</p>
          </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 sm:p-8" style={{ backgroundColor: "#FAFAF6" }}>
        <div className="w-full max-w-lg sm:rounded-2xl sm:border sm:border-black/10 sm:bg-white sm:p-10 sm:shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <a href={marketingUrl("/")} className="mb-8 inline-block">
            <Image src="/logo2.png" alt="Mohasib" width={140} height={42} style={{ objectFit: "contain", height: "auto" }} />
          </a>

          {!invitationToken && <button
            onClick={() => setStep(1)}
            className="flex items-center gap-1.5 text-[12px] text-[#6B7280] hover:text-[#1A1A2E] mb-5 transition-colors"
          >
            ← {userType === "fiduciaire" ? "Cabinet comptable" : accountMode === "invoicing" ? "Facturation gratuite" : "TPME"}
          </button>}

          <h1 className="text-2xl font-bold text-navy mb-1">Créer un compte</h1>
          <p className="text-sm text-gray-500 mb-7">
            Déjà inscrit ?{" "}
            <Link href={appUrl("/connexion")} className="text-gold hover:underline font-medium">Se connecter</Link>
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
            {!invitationToken && accountMode === "full" && <>
              <div>
                <label htmlFor="signup-role" className="label">Votre rôle</label>
                <select id="signup-role" className="input" required value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="">Sélectionnez votre rôle</option>
                  {(userType === "fiduciaire"
                    ? ["Expert-comptable", "Gérant de cabinet", "Comptable", "Collaborateur de cabinet", "Autre"]
                    : ["Entrepreneur / indépendant", "Dirigeant de TPE/PME", "Comptable en entreprise", "Responsable administratif et financier", "Autre"]
                  ).map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="signup-size" className="label">
                    {userType === "fiduciaire" ? "Nombre de collaborateurs" : "Taille de l’entreprise"}
                  </label>
                  <select id="signup-size" className="input" required value={form.organization_size}
                    onChange={(e) => setForm((f) => ({ ...f, organization_size: e.target.value }))}>
                    <option value="">Sélectionnez</option>
                    {["1", "2–5", "6–10", "11–25", "Plus de 25"].map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="signup-volume" className="label">
                    {userType === "fiduciaire" ? "Dossiers clients gérés" : "Documents par mois"}
                  </label>
                  <select id="signup-volume" className="input" required value={form.monthly_volume}
                    onChange={(e) => setForm((f) => ({ ...f, monthly_volume: e.target.value }))}>
                    <option value="">Sélectionnez</option>
                    {(userType === "fiduciaire"
                      ? ["1–10", "11–25", "26–50", "51–100", "Plus de 100"]
                      : ["Moins de 20", "20–50", "51–100", "101–300", "Plus de 300"]
                    ).map((volume) => <option key={volume} value={volume}>{volume}</option>)}
                  </select>
                </div>
              </div>
              <fieldset>
                <legend className="label">Quels sont vos principaux besoins ?</legend>
                <div className="grid gap-2 rounded-lg border border-black/10 bg-white p-3 sm:grid-cols-2">
                  {[...NEED_OPTIONS, ...(userType === "fiduciaire" ? ["Gestion multi-dossiers", "Bilan et CPC"] : [])].map((need) => (
                    <label key={need} className="flex cursor-pointer items-center gap-2 text-[12px] text-[#374151]">
                      <input
                        type="checkbox"
                        checked={form.needs.includes(need)}
                        onChange={(event) => setForm((current) => ({
                          ...current,
                          needs: event.target.checked
                            ? [...current.needs, need]
                            : current.needs.filter((item) => item !== need),
                        }))}
                        className="accent-[#C8924A]"
                      />
                      {need}
                    </label>
                  ))}
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#374151]">
                    <input
                      type="checkbox"
                      checked={form.needs.includes("Autre")}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        needs: event.target.checked
                          ? [...current.needs, "Autre"]
                          : current.needs.filter((item) => item !== "Autre"),
                        other_need: event.target.checked ? current.other_need : "",
                      }))}
                      className="accent-[#C8924A]"
                    />
                    Autre
                  </label>
                </div>
                {form.needs.includes("Autre") && (
                  <input
                    className="input mt-2"
                    placeholder="Décrivez votre besoin"
                    required
                    value={form.other_need}
                    onChange={(event) => setForm((current) => ({ ...current, other_need: event.target.value }))}
                  />
                )}
              </fieldset>
            </>}
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
            <div>
              <label htmlFor="signup-confirm-password" className="label">Confirmer le mot de passe</label>
              <div className="relative">
                <input id="signup-confirm-password" type={showConfirmPwd ? "text" : "password"} className="input pr-10"
                  placeholder="••••••••" required minLength={PASSWORD_MIN_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)} />
                <button type="button"
                  aria-label={showConfirmPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showConfirmPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPassword.length > 0 && confirmPassword !== form.password && (
                <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas.</p>
              )}
            </div>

            {error && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                <p>{error}</p>
                {error.startsWith("Un compte existe déjà") && (
                  <div className="flex gap-3 mt-2 font-semibold">
                    <Link href={appUrl("/connexion")} className="hover:underline">Se connecter</Link>
                    <Link href="/mot-de-passe-oublie" className="hover:underline">Mot de passe oublié</Link>
                  </div>
                )}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg font-medium text-sm text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: "#C8924A" }}>
              {loading ? "Création en cours..." : invitationToken ? "Créer mon accès Collaborateur" : accountMode === "invoicing" ? "Créer mon compte gratuit" : "Créer mon compte"}
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

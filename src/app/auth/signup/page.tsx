"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Eye, EyeOff, CheckCircle } from "lucide-react";

export default function SignupPage() {
  const [form, setForm] = useState({
    full_name: "",
    company: "",
    email: "",
    password: "",
  });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: {
          full_name: form.full_name,
          company: form.company,
        },
      },
    });

    setLoading(false);
    if (err) {
      setError(err.message);
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
          <Link href="/auth/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: "#C8924A" }}>
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#FAFAF6" }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ backgroundColor: "#0D1526" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: "#C8924A" }}>
            <span className="text-white font-bold text-base">م</span>
          </div>
          <div>
            <span className="text-white font-bold text-xl">Mohasib</span>
            <span className="block text-xs" style={{ color: "#C8924A" }}>محاسب</span>
          </div>
        </div>
        <div>
          <h2 className="text-3xl font-bold text-white leading-tight mb-4">
            Démarrez votre comptabilité<br />en quelques minutes
          </h2>
          <p className="text-gray-400 text-sm leading-relaxed">
            Rejoignez des centaines de PME marocaines qui font confiance à Mohasib
            pour gérer leur comptabilité simplement et efficacement.
          </p>
        </div>
        <p className="text-xs text-gray-600">© {new Date().getFullYear()} Mohasib.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#C8924A" }}>
              <span className="text-white font-bold text-sm">م</span>
            </div>
            <span className="font-bold text-navy text-lg">Mohasib</span>
          </div>

          <h1 className="text-2xl font-bold text-navy mb-1">Créer un compte</h1>
          <p className="text-sm text-gray-500 mb-7">
            Déjà inscrit ?{" "}
            <Link href="/auth/login" className="text-gold hover:underline font-medium">
              Se connecter
            </Link>
          </p>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="label">Nom complet</label>
              <input className="input" placeholder="Prénom Nom" required
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Entreprise</label>
              <input className="input" placeholder="Ma Société SARL"
                value={form.company}
                onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
            </div>
            <div>
              <label className="label">Adresse e-mail</label>
              <input type="email" className="input" placeholder="vous@exemple.ma" required
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
              <p className="text-xs text-red-500 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg font-medium text-sm text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: "#C8924A" }}>
              {loading ? "Création en cours..." : "Créer mon compte"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              En créant un compte, vous acceptez nos{" "}
              <span className="text-gold cursor-pointer hover:underline">Conditions d&apos;utilisation</span>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

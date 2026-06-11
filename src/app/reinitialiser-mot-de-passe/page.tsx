"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { translateError } from "@/lib/errors";

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    let mounted = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        setReady(true);
        setChecking(false);
        setError("");
      }
    });

    async function consumeRecoveryLink() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const query = new URLSearchParams(window.location.search);
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = query.get("code");

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!sessionError) window.history.replaceState({}, "", "/reinitialiser-mot-de-passe");
      } else if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!exchangeError) window.history.replaceState({}, "", "/reinitialiser-mot-de-passe");
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setReady(!!data.session);
      setChecking(false);
      if (!data.session) setError("Ce lien est invalide ou expiré. Demandez un nouveau lien de réinitialisation.");
    }
    void consumeRecoveryLink();

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) return setError("Les mots de passe ne correspondent pas.");
    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) return setError(translateError(updateError));
    router.push("/connexion");
    router.refresh();
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#FAFAF6] p-8">
    <div className="w-full max-w-sm">
      <Image src="/logo2.png" alt="Mohasib" width={140} height={42} className="mb-8 h-auto object-contain" />
      <h1 className="text-2xl font-bold text-[#0D1526]">Nouveau mot de passe</h1>
      <p className="mt-2 text-sm text-gray-500">Choisissez un nouveau mot de passe sécurisé.</p>
      {checking && <p className="mt-6 text-sm text-gray-500">Vérification du lien...</p>}
      {ready && <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="label">Nouveau mot de passe<input type="password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} className="input mt-1" /></label>
        <label className="label">Confirmer le mot de passe<input type="password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="input mt-1" /></label>
        {error && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        <button disabled={loading} className="w-full rounded-lg bg-[#C8924A] py-2.5 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Enregistrement..." : "Enregistrer le nouveau mot de passe"}</button>
      </form>}
      {!checking && !ready && error && <div className="mt-6"><p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p><Link href="/mot-de-passe-oublie" className="mt-4 block text-center text-xs font-semibold text-[#C8924A]">Demander un nouveau lien</Link></div>}
    </div>
  </main>;
}

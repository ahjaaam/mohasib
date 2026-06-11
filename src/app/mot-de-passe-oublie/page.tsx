"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { translateError } from "@/lib/errors";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("erreur");
    if (reason) setError("Le lien de réinitialisation est invalide ou expiré. Demandez un nouveau lien.");
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const redirectTo = `${window.location.origin}/reinitialiser-mot-de-passe`;
    const { error: resetError } = await createClient().auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (resetError) return setError(translateError(resetError));
    setSent(true);
  }

  return <main className="flex min-h-screen items-center justify-center bg-[#FAFAF6] p-8">
    <div className="w-full max-w-sm">
      <Image src="/logo2.png" alt="Mohasib" width={140} height={42} className="mb-8 h-auto object-contain" />
      {sent ? <div className="text-center">
        <CheckCircle size={34} className="mx-auto text-emerald-600" />
        <h1 className="mt-4 text-xl font-bold text-[#0D1526]">Vérifiez votre boîte mail</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">Un lien de réinitialisation a été envoyé à {email}.</p>
        <Link href="/connexion" className="mt-6 inline-flex rounded-lg bg-[#C8924A] px-5 py-2.5 text-sm font-semibold text-white">Retour à la connexion</Link>
      </div> : <>
        <h1 className="text-2xl font-bold text-[#0D1526]">Mot de passe oublié</h1>
        <p className="mt-2 text-sm leading-6 text-gray-500">Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="label">Adresse e-mail<input type="email" required value={email} onChange={event => setEmail(event.target.value)} className="input mt-1" placeholder="vous@exemple.ma" /></label>
          {error && <p className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          <button disabled={loading} className="w-full rounded-lg bg-[#C8924A] py-2.5 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Envoi..." : "Envoyer le lien"}</button>
        </form>
        <Link href="/connexion" className="mt-5 block text-center text-xs font-medium text-[#C8924A]">Retour à la connexion</Link>
      </>}
    </div>
  </main>;
}

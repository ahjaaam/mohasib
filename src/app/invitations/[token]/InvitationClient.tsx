"use client";

import Link from "next/link";
import { useState } from "react";
import { LogOut, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROUTES } from "@/lib/routes";

type Props = {
  token: string;
  invitation: {
    email: string;
    roleLabel: string;
    accountName: string;
    accessLabel: string;
  };
  currentEmail: string | null;
};

export default function InvitationClient({ token, invitation, currentEmail }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setLoading(true);
    const response = await fetch(`/api/invitations/${token}`, { method: "POST" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error === "email_mismatch" ? `Cette invitation est destinée à ${data.invited_email}.` : "Impossible d'accepter cette invitation.");
      setLoading(false);
      return;
    }
    window.location.href = data.redirect;
  }

  async function signOut() {
    await createClient().auth.signOut();
    window.location.reload();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF6] p-5">
      <div className="w-full max-w-[480px] rounded-xl border border-black/[0.08] bg-white p-7 shadow-[0_18px_50px_rgba(13,21,38,0.08)]">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#C8924A]/10 text-[#C8924A]">
          <ShieldCheck size={22} />
        </div>
        <h1 className="mt-5 text-[22px] font-bold text-[#0D1526]">{invitation.accountName} vous invite à rejoindre Mohasib</h1>
        <div className="mt-5 rounded-lg bg-[#FAFAF6] p-4 text-[13px]">
          <p><span className="text-[#6B7280]">Rôle :</span> <strong>{invitation.roleLabel}</strong></p>
          <p className="mt-2"><span className="text-[#6B7280]">Accès :</span> <strong>{invitation.accessLabel}</strong></p>
          <p className="mt-2"><span className="text-[#6B7280]">Adresse invitée :</span> <strong>{invitation.email}</strong></p>
        </div>

        {!currentEmail ? (
          <Link href={`${ROUTES.INSCRIPTION}?invitation=${token}`} className="mt-6 flex min-h-11 items-center justify-center rounded-lg bg-[#C8924A] px-4 text-[13px] font-bold text-white">
            Créer mon compte pour accepter
          </Link>
        ) : currentEmail.toLowerCase() === invitation.email.toLowerCase() ? (
          <button onClick={accept} disabled={loading} className="mt-6 min-h-11 w-full rounded-lg bg-[#C8924A] px-4 text-[13px] font-bold text-white disabled:opacity-60">
            {loading ? "Acceptation..." : "Accepter l'invitation"}
          </button>
        ) : (
          <>
            <p className="mt-6 text-[13px] leading-6 text-[#6B7280]">
              Cette invitation est destinée à <strong>{invitation.email}</strong>. Déconnectez-vous pour accepter avec le bon compte.
            </p>
            <button onClick={signOut} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-black/[0.10] text-[13px] font-semibold text-[#0D1526]">
              <LogOut size={15} /> Se déconnecter
            </button>
          </>
        )}
        {error && <p className="mt-4 text-[12px] text-red-600">{error}</p>}
      </div>
    </main>
  );
}

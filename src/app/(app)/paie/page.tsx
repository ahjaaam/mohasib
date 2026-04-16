"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { Banknote, Lock } from "lucide-react";

function LockedFeature({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-[rgba(0,0,0,0.08)] rounded-lg px-4 py-3 opacity-60 cursor-not-allowed"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <Lock size={14} className="text-[#C8924A] flex-shrink-0" />
      <div>
        <p className="text-[13px] font-medium text-[#1A1A2E]">{title}</p>
        <p className="text-[11.5px] text-[#6B7280]">{sub}</p>
      </div>
    </div>
  );
}

export default function PaiePage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [notified, setNotified] = useState(false);

  async function handleNotify(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    await supabase.from("fiduciaire_waitlist").insert({ email, source: "paie_waitlist" });
    setNotified(true);
    toast.success("Vous serez notifié !");
  }

  return (
    <div className="max-w-2xl">
      <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl p-8 text-center"
        style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>

        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
          style={{ background: "rgba(200,146,74,0.1)" }}>
          <Banknote size={28} className="text-[#C8924A]" />
        </div>

        <h1 className="text-[22px] font-semibold text-[#1A1A2E] mb-2">La Paie</h1>
        <p className="text-[14px] text-[#6B7280] mb-4 max-w-sm mx-auto">
          Gérez vos employés, générez des bulletins de paie conformes et déclarez vos charges sociales.
        </p>

        <span className="inline-block text-[12px] font-medium text-[#C8924A] border border-[#C8924A] rounded-full px-4 py-1 mb-6">
          Bientôt disponible
        </span>

        <div className="text-left space-y-2 mb-6">
          <LockedFeature title="Gestion des employés"       sub="Fiches employés, contrats, ancienneté" />
          <LockedFeature title="Bulletins de paie"          sub="Conformes au barème marocain 2024" />
          <LockedFeature title="Calcul CNSS / AMO / IR"     sub="Cotisations salariales et patronales" />
          <LockedFeature title="Déclarations sociales"      sub="CNSS, AMO, IR — prêtes à déposer" />
          <LockedFeature title="Export fiduciaire"          sub="Journal de paie au format CGNC" />
        </div>

        {notified ? (
          <p className="text-[13px] text-[#059669] font-medium">✓ Vous serez notifié !</p>
        ) : (
          <form onSubmit={handleNotify} className="flex gap-2 max-w-sm mx-auto">
            <input
              className="input flex-1"
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit" className="btn btn-gold flex-shrink-0">
              Me notifier →
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

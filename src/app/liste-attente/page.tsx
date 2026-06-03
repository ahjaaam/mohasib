import Link from "next/link";
import { Toaster } from "react-hot-toast";
import { ROUTES } from "@/lib/routes";
import WaitlistClient from "./WaitlistClient";

export default function ListeAttentePage() {
  return (
    <main className="min-h-screen bg-[#FAFAF6] px-5 py-10">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
      <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[1fr_420px] md:items-center">
        <div>
          <Link href={ROUTES.HOME} className="text-[13px] font-semibold text-[#C8924A]">Mohasib</Link>
          <h1 className="mt-8 text-[38px] font-bold leading-tight text-[#0D1526]">Rejoindre la liste d'attente</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#6B7280]">
            Soyez parmi les premiers à accéder aux fonctionnalités avancées pour entrepreneurs et cabinets comptables au Maroc.
          </p>
          <div className="mt-6 inline-flex rounded-full bg-[#FFF7ED] px-4 py-2 text-[13px] font-bold text-[#92400E]">
            Accès prioritaire · Lancement progressif
          </div>
        </div>
        <WaitlistClient />
      </div>
    </main>
  );
}

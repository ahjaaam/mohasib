import { Toaster } from "react-hot-toast";
import PublicNavbar from "@/components/PublicNavbar";
import PublicFooter from "@/components/PublicFooter";
import WaitlistClient from "./WaitlistClient";

export default function ListeAttentePage() {
  return (
    <main className="public-site">
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px" } }} />
      <PublicNavbar />
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-10 md:grid-cols-[1fr_420px] md:items-center">
        <div>
          <h1 className="mt-8 text-[38px] font-bold leading-tight text-[#0D1526]">Rejoindre la liste d'attente</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#6B7280]">
            Soyez parmi les premiers à accéder aux fonctionnalités avancées pour entrepreneurs et cabinets comptables au Maroc.
          </p>
          <div className="mt-6 inline-flex border border-[rgba(192,174,175,0.28)] bg-[rgba(192,174,175,0.10)] px-4 py-2 text-[13px] font-bold text-[#7A6668]">
            Accès prioritaire · Lancement progressif
          </div>
        </div>
        <WaitlistClient />
      </div>
      <PublicFooter />
    </main>
  );
}

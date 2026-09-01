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
          <h1 className="mt-8 text-[38px] font-bold leading-tight text-[#0D1526]">Accédez en priorité aux prochaines fonctionnalités</h1>
          <p className="mt-3 max-w-xl text-[15px] leading-7 text-[#6B7280]">
            Indiquez votre profil et vos coordonnées. Nous vous préviendrons dès que l’accès correspondant à vos besoins sera disponible.
          </p>
          <div className="mt-6 inline-flex border border-[rgba(192,174,175,0.28)] bg-[rgba(192,174,175,0.10)] px-4 py-2 text-[13px] font-bold text-[#7A6668]">
            Inscription sans engagement · Lancement progressif
          </div>
        </div>
        <WaitlistClient />
      </div>
      <PublicFooter />
    </main>
  );
}

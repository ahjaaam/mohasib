import Image from "next/image";
import Link from "next/link";
import { Clock3 } from "lucide-react";

export default function PendingApprovalPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FAFAF6] px-6">
      <section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 text-center shadow-sm">
        <Image src="/logo2.png" alt="Mohasib" width={140} height={42} className="mx-auto h-auto" />
        <div className="mx-auto mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <Clock3 size={26} />
        </div>
        <h1 className="mt-5 text-xl font-bold text-[#0D1526]">Votre demande est en cours de validation</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Votre compte a bien été enregistré. L&apos;équipe Mohasib doit l&apos;activer manuellement avant votre première connexion.
        </p>
        <p className="mt-3 text-xs text-gray-400">
          Vous pourrez vous connecter avec vos identifiants dès que votre accès aura été approuvé.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-lg bg-[#0D1526] px-5 py-2.5 text-sm font-semibold text-white">
          Retour au site
        </Link>
      </section>
    </main>
  );
}

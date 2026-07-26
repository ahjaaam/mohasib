import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Hors ligne — Mohasib",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#FAFAF6] px-6 py-12">
      <section className="w-full max-w-sm border border-black/10 bg-white p-8 text-center shadow-sm">
        <Image
          src="/icons/icon-192.png"
          alt=""
          width={64}
          height={64}
          className="mx-auto"
          priority
        />
        <h1 className="mt-5 text-xl font-bold text-[#0D1526]">Vous êtes hors ligne</h1>
        <p className="mt-3 text-[13px] leading-6 text-[#6B7280]">
          Mohasib protège vos données comptables et ne les conserve pas dans le cache
          hors ligne. Reconnectez-vous pour reprendre votre travail.
        </p>
        <Link href="/" className="btn btn-gold mt-6 min-h-10 justify-center px-5">
          Réessayer
        </Link>
      </section>
    </main>
  );
}

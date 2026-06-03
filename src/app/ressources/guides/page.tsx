import Link from "next/link";
import { ROUTES } from "@/lib/routes";

const guides = [
  "Guide TVA pour PME marocaines",
  "Checklist clôture mensuelle",
  "Guide paie et CNSS 2026",
  "Guide export fiduciaire",
];

export default function GuidesPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF6] px-5 py-10">
      <div className="mx-auto max-w-4xl">
        <Link href={ROUTES.RESSOURCES} className="text-[13px] font-semibold text-[#C8924A]">← Ressources</Link>
        <h1 className="mt-8 text-[34px] font-bold text-[#0D1526]">Guides</h1>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {guides.map((guide) => (
            <div key={guide} className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
              <h2 className="text-[16px] font-bold text-[#0D1526]">{guide}</h2>
              <p className="mt-2 text-[13px] text-[#6B7280]">Téléchargement PDF avec capture email à connecter.</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

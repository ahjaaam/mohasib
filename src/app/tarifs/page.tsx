import Link from "next/link";
import { Check, X } from "lucide-react";
import { ROUTES } from "@/lib/routes";

const businessPlans = [
  {
    name: "Starter",
    price: "99 MAD",
    features: ["50 OCR / mois", "5GB stockage", "Facturation", "TVA simple"],
    missing: ["Paie", "Import bancaire"],
  },
  {
    name: "Business",
    price: "229 MAD",
    popular: true,
    features: ["250 OCR / mois", "25GB stockage", "Paie 10 employés", "Import bancaire"],
    missing: ["Utilisateurs multiples"],
  },
  {
    name: "Business Pro",
    price: "449 MAD",
    features: ["OCR illimité", "Stockage illimité", "Paie illimitée", "3 utilisateurs"],
    missing: [],
  },
];

const cabinetPlans = [
  { name: "Comptable Pro Starter", price: "299 MAD", features: ["5 dossiers", "100 OCR / mois", "25GB stockage"], missing: ["Déclarations masse"] },
  { name: "Comptable Pro", price: "599 MAD", popular: true, features: ["20 dossiers", "500 OCR / mois", "100GB stockage", "2 utilisateurs"], missing: [] },
  { name: "Comptable Pro Illimité", price: "999 MAD", features: ["Dossiers illimités", "OCR illimité", "5 utilisateurs", "API"], missing: [] },
];

function PlanCard({ plan }: { plan: (typeof businessPlans)[number] }) {
  return (
    <div className={`relative bg-white border rounded-2xl p-6 ${plan.popular ? "border-[#C8924A] shadow-lg" : "border-[rgba(0,0,0,0.08)]"}`}>
      {plan.popular && (
        <span className="absolute right-4 top-4 text-[10px] font-bold text-[#92400E] bg-[#FEF3C7] px-2 py-1 rounded-full">POPULAR</span>
      )}
      <h2 className="text-[18px] font-bold text-[#0D1526]">{plan.name}</h2>
      <p className="text-[28px] font-bold text-[#0D1526] mt-2">{plan.price}<span className="text-[12px] text-[#6B7280]"> / mois</span></p>
      <div className="mt-5 space-y-2">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-[13px] text-[#374151]">
            <Check size={14} className="text-[#C8924A]" /> {feature}
          </div>
        ))}
        {plan.missing.map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-[13px] text-[#9CA3AF]">
            <X size={14} /> {feature}
          </div>
        ))}
      </div>
      <Link href={ROUTES.INSCRIPTION} className="mt-6 inline-flex w-full justify-center rounded-full bg-[#C8924A] px-4 py-2.5 text-[13px] font-bold text-[#0D1526]">
        Démarrer gratuitement
      </Link>
    </div>
  );
}

export default function TarifsPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF6] px-5 py-10">
      <div className="mx-auto max-w-6xl">
        <Link href={ROUTES.HOME} className="text-[13px] font-semibold text-[#C8924A]">Mohasib</Link>
        <div className="mt-8 mb-8">
          <p className="inline-flex rounded-full bg-[#FFF7ED] px-3 py-1 text-[12px] font-bold text-[#92400E]">7 jours gratuits · Sans carte bancaire</p>
          <h1 className="mt-4 text-[34px] font-bold text-[#0D1526]">Tarifs Mohasib</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-[#6B7280]">Choisissez un plan pour votre entreprise ou votre cabinet comptable.</p>
        </div>

        <section className="mb-10">
          <h2 className="mb-4 text-[18px] font-bold text-[#0D1526]">Business</h2>
          <div className="grid gap-4 md:grid-cols-3">{businessPlans.map((plan) => <PlanCard key={plan.name} plan={plan} />)}</div>
        </section>

        <section>
          <h2 className="mb-4 text-[18px] font-bold text-[#0D1526]">Comptable Pro</h2>
          <div className="grid gap-4 md:grid-cols-3">{cabinetPlans.map((plan) => <PlanCard key={plan.name} plan={plan} />)}</div>
        </section>
      </div>
    </main>
  );
}

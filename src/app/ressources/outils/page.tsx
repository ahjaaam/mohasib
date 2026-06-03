import Link from "next/link";
import { ROUTES } from "@/lib/routes";

const tools = [
  { name: "Simulateur TVA", text: "CA HT × taux - TVA déductible." },
  { name: "Simulateur IS", text: "Barèmes progressifs marocains." },
  { name: "Bulletin de paie", text: "CNSS, AMO, frais professionnels et IR." },
  { name: "Rentabilité", text: "CA - charges - masse salariale - TVA." },
];

export default function OutilsPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF6] px-5 py-10">
      <div className="mx-auto max-w-4xl">
        <Link href={ROUTES.RESSOURCES} className="text-[13px] font-semibold text-[#C8924A]">← Ressources</Link>
        <h1 className="mt-8 text-[34px] font-bold text-[#0D1526]">Outils</h1>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {tools.map((tool) => (
            <div key={tool.name} className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
              <h2 className="text-[16px] font-bold text-[#0D1526]">{tool.name}</h2>
              <p className="mt-2 text-[13px] text-[#6B7280]">{tool.text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

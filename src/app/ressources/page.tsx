import Link from "next/link";
import { BookOpen, Calculator, FileText } from "lucide-react";
import { ROUTES } from "@/lib/routes";

const cards = [
  {
    title: "Blog",
    icon: BookOpen,
    text: "Articles pratiques sur la TVA, la facturation, la paie et la conformité au Maroc.",
    href: "/ressources/blog",
  },
  {
    title: "Outils",
    icon: Calculator,
    text: "Simulateurs TVA, IS, bulletin de paie et rentabilité, sans appel API.",
    href: "/ressources/outils",
  },
  {
    title: "Guides",
    icon: FileText,
    text: "Guides PDF pour entrepreneurs, cabinets et responsables administratifs.",
    href: "/ressources/guides",
  },
];

export default function RessourcesPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF6] px-5 py-10">
      <div className="mx-auto max-w-5xl">
        <Link href={ROUTES.HOME} className="text-[13px] font-semibold text-[#C8924A]">Mohasib</Link>
        <div className="mt-8 mb-8">
          <h1 className="text-[34px] font-bold text-[#0D1526]">Ressources</h1>
          <p className="mt-2 max-w-2xl text-[15px] text-[#6B7280]">Des contenus et outils pour mieux piloter la comptabilité marocaine au quotidien.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map(({ title, icon: Icon, text, href }) => (
            <Link key={title} href={href} className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-6 transition hover:border-[#C8924A]">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#C8924A]">
                <Icon size={20} />
              </div>
              <h2 className="text-[18px] font-bold text-[#0D1526]">{title}</h2>
              <p className="mt-2 text-[13px] leading-6 text-[#6B7280]">{text}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

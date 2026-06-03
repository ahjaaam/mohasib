import Link from "next/link";
import { ROUTES } from "@/lib/routes";

const articles = [
  "Comprendre la TVA mensuelle au Maroc",
  "Comment préparer une déclaration CNSS propre",
  "Factures, devis et avoirs : le bon workflow",
];

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-[#FAFAF6] px-5 py-10">
      <div className="mx-auto max-w-4xl">
        <Link href={ROUTES.RESSOURCES} className="text-[13px] font-semibold text-[#C8924A]">← Ressources</Link>
        <h1 className="mt-8 text-[34px] font-bold text-[#0D1526]">Blog</h1>
        <div className="mt-6 grid gap-3">
          {articles.map((article) => (
            <div key={article} className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-5">
              <h2 className="text-[16px] font-bold text-[#0D1526]">{article}</h2>
              <p className="mt-2 text-[13px] text-[#6B7280]">Article à publier depuis le CMS.</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

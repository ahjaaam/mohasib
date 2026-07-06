"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";
import type { DownloadableGuide } from "@/lib/guides";

function slugValue(slug: DownloadableGuide["slug"]) {
  return typeof slug === "string" ? slug : slug?.current ?? null;
}

export default function GuidesClient({ guides }: { guides: DownloadableGuide[] }) {
  const [query, setQuery] = useState("");

  const filteredGuides = guides.filter((guide) => {
    const searchText = `${guide.title} ${guide.description ?? ""} ${guide.tags.join(" ")}`.toLowerCase();
    return !query.trim() || searchText.includes(query.trim().toLowerCase());
  });

  return (
    <>
      <section className="border-b border-[rgba(13,21,38,0.08)] bg-[#FAFAF6] px-6 py-[64px]">
        <div className="mx-auto max-w-4xl text-center">
          <a href="/ressources" className="text-[12px] font-semibold text-[#C8924A]">← Ressources</a>
          <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.18em] text-[#C8924A]">Documents téléchargeables</p>
          <h1 className="mt-4 text-[38px] font-bold leading-tight text-[#0D1526] md:text-[52px]">Modèles, templates et documents gratuits</h1>
          <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-[#6B7280]">
            Une bibliothèque de documents utiles pour gérer, créer et sécuriser votre activité au Maroc.
          </p>
          {guides.length > 0 && (
            <div className="mx-auto mt-8 max-w-3xl">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF]" size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  type="search"
                  placeholder="Rechercher un document, contrat, modèle, TVA..."
                  className="w-full rounded-2xl border border-[rgba(13,21,38,0.10)] bg-white py-4 pl-12 pr-4 text-left text-[14px] text-[#0D1526] shadow-[0_14px_35px_rgba(13,21,38,0.08)] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#C8924A]"
                />
              </label>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 py-10">
        {guides.length === 0 ? (
          <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-[rgba(13,21,38,0.16)] bg-white p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#C8924A]/10 text-[#C8924A]">
              <FileText size={26} />
            </div>
            <h2 className="mt-5 text-[20px] font-bold text-[#0D1526]">Aucun document publié</h2>
            <p className="mx-auto mt-3 max-w-xl text-[13.5px] leading-6 text-[#6B7280]">
              Les documents affichés ici seront uniquement ceux publiés dans Sanity.
            </p>
          </div>
        ) : (
          <>
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
            {filteredGuides.map((guide) => {
              const slug = slugValue(guide.slug);
              const href = slug ? `/ressources/documents/${encodeURIComponent(slug)}` : "/ressources/documents";

              return (
              <Link key={guide._id} href={href} className="group rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-6 shadow-[0_10px_28px_rgba(13,21,38,0.05)] transition hover:border-[#C8924A] hover:shadow-[0_16px_42px_rgba(13,21,38,0.09)]">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#C8924A]/10 text-[#C8924A]">
                    <FileText size={26} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-bold leading-6 text-[#0D1526]">{guide.title}</h2>
                    {guide.description && <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[#6B7280]">{guide.description}</p>}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {guide.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[#C8924A]/10 px-2.5 py-1 text-[11px] font-semibold text-[#C8924A]">{tag}</span>
                  ))}
                  {Boolean(guide.pages) && <span className="ml-auto text-[12px] font-semibold text-[#6B7280]">{guide.pages} {typeof guide.pages === "number" ? "pages" : ""}</span>}
                </div>
                <span className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-[#C8924A] px-4 py-3 text-[13px] font-bold text-[#C8924A] transition group-hover:bg-[#C8924A] group-hover:text-white">
                  Voir le document
                </span>
              </Link>
              );
            })}
          </div>
          {filteredGuides.length === 0 && (
            <div className="mx-auto mt-6 max-w-3xl rounded-2xl border border-dashed border-[rgba(13,21,38,0.16)] bg-white p-8 text-center">
              <h2 className="text-[18px] font-bold text-[#0D1526]">Aucun document trouvé</h2>
              <p className="mx-auto mt-2 max-w-xl text-[13px] leading-6 text-[#6B7280]">
                Essayez avec un autre mot-clé comme contrat, TVA, facture ou bail.
              </p>
            </div>
          )}
          </>
        )}
      </section>
    </>
  );
}

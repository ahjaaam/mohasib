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
      <section className="public-page-hero">
        <div className="mx-auto max-w-4xl text-center">
          <a href="/ressources" className="text-[12px] font-semibold text-[#B58A52]">← Ressources</a>
          <p className="public-eyebrow mt-6">Documents téléchargeables</p>
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
                  className="w-full border border-[#DADAD5] bg-white py-4 pl-12 pr-4 text-left text-[14px] text-[#0D1526] outline-none transition placeholder:text-[#9CA3AF] focus:border-[#B58A52]"
                />
              </label>
            </div>
          )}
        </div>
      </section>

      <section className="px-6 py-10">
        {guides.length === 0 ? (
          <div className="public-surface public-dashed-surface mx-auto max-w-3xl p-8 text-center">
            <div className="public-icon-tile mx-auto h-12 w-12">
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
              <Link key={guide._id} href={href} className="public-surface public-interactive-surface group p-6">
                <div className="flex gap-4">
                  <div className="public-icon-tile h-12 w-12 flex-shrink-0">
                    <FileText size={26} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-bold leading-6 text-[#0D1526]">{guide.title}</h2>
                    {guide.description && <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[#6B7280]">{guide.description}</p>}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {guide.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[#B58A52]/10 px-2.5 py-1 text-[11px] font-semibold text-[#B58A52]">{tag}</span>
                  ))}
                  {Boolean(guide.pages) && <span className="ml-auto text-[12px] font-semibold text-[#6B7280]">{guide.pages} {typeof guide.pages === "number" ? "pages" : ""}</span>}
                </div>
                <span className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-[#B58A52] px-4 py-3 text-[13px] font-bold text-[#B58A52] transition group-hover:border-[#0D1526] group-hover:bg-[#0D1526] group-hover:text-white">
                  Voir le document
                </span>
              </Link>
              );
            })}
          </div>
          {filteredGuides.length === 0 && (
            <div className="public-surface public-dashed-surface mx-auto mt-6 max-w-3xl p-8 text-center">
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

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, FileText, Search, X } from "lucide-react";
import type { DownloadableGuide } from "@/lib/guides";

function slugValue(slug: DownloadableGuide["slug"]) {
  return typeof slug === "string" ? slug : slug?.current ?? null;
}

function fileFormat(fileUrl?: string) {
  const extension = fileUrl?.split("?")[0].split(".").pop()?.toUpperCase();
  return extension && extension.length <= 5 ? extension : "PDF";
}

function contentType(guide: DownloadableGuide) {
  const text = `${guide.title} ${guide.description ?? ""} ${guide.tags.join(" ")}`.toLowerCase();
  if (/checklist|liste de contr[oô]le/.test(text)) return "Checklist";
  if (/contrat|bail|statuts|convention/.test(text)) return "Modèle juridique";
  if (/tableau|calcul|budget|planning|excel/.test(text)) return "Tableur";
  if (/guide|manuel/.test(text)) return "Guide";
  return "Modèle";
}

export default function GuidesClient({ guides }: { guides: DownloadableGuide[] }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [selectedContentType, setSelectedContentType] = useState("");
  const [format, setFormat] = useState("");

  const topics = [...new Set(guides.flatMap((guide) => guide.tags))].sort((a, b) => a.localeCompare(b, "fr"));
  const contentTypes = [...new Set(guides.map(contentType))].sort((a, b) => a.localeCompare(b, "fr"));
  const formats = [...new Set(guides.map((guide) => fileFormat(guide.fileUrl)))].sort();

  const filteredGuides = guides.filter((guide) => {
    const guideType = contentType(guide);
    const guideFormat = fileFormat(guide.fileUrl);
    const searchText = `${guide.title} ${guide.description ?? ""} ${guide.tags.join(" ")} ${guideType} ${guideFormat}`.toLowerCase();
    return (
      (!topic || guide.tags.includes(topic)) &&
      (!selectedContentType || guideType === selectedContentType) &&
      (!format || guideFormat === format) &&
      (!query.trim() || searchText.includes(query.trim().toLowerCase()))
    );
  });

  return (
    <>
      <div className="px-4 pt-6 md:px-6">
        <section
          className="documents-hero-card public-page-hero mx-auto max-w-6xl overflow-hidden"
          style={{ background: "linear-gradient(135deg, #0D1526 0%, #976224 100%)" }}
        >
          <div className="mx-auto max-w-5xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#F0C98F]">Documents téléchargeables</p>
            <h1 className="mt-4 text-[38px] font-bold leading-tight text-white md:text-[52px]">Parcourir toutes les ressources</h1>
            <p className="mx-auto mt-4 max-w-2xl text-[18px] leading-8 text-white/80 md:text-[20px]">
              Près de 300 ressources gratuites pour développer votre entreprise
            </p>
            {guides.length > 0 && (
              <div className="documents-filter-panel mt-8 grid gap-4 bg-white/95 p-5 text-left shadow-[0_14px_35px_rgba(5,10,20,0.20)] sm:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-bold text-[#0D1526]">Tous les sujets</span>
                  <span className="relative block">
                    <select value={topic} onChange={(event) => setTopic(event.target.value)} className="documents-filter-control h-12 w-full appearance-none border border-[#D9D5CD] bg-white px-3 pr-10 text-[13px] font-medium text-[#0D1526] outline-none transition focus:border-[#976224] focus:ring-2 focus:ring-[#976224]/15">
                      <option value="">Tous les sujets</option>
                      {topics.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0D1526]" size={17} aria-hidden="true" />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-bold text-[#0D1526]">Tous les types</span>
                  <span className="relative block">
                    <select value={selectedContentType} onChange={(event) => setSelectedContentType(event.target.value)} className="documents-filter-control h-12 w-full appearance-none border border-[#D9D5CD] bg-white px-3 pr-10 text-[13px] font-medium text-[#0D1526] outline-none transition focus:border-[#976224] focus:ring-2 focus:ring-[#976224]/15">
                      <option value="">Tous les types</option>
                      {contentTypes.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0D1526]" size={17} aria-hidden="true" />
                  </span>
                </label>

                <label className="block">
                  <span className="mb-2 block text-[11px] font-bold text-[#0D1526]">Tous les formats</span>
                  <span className="relative block">
                    <select value={format} onChange={(event) => setFormat(event.target.value)} className="documents-filter-control h-12 w-full appearance-none border border-[#D9D5CD] bg-white px-3 pr-10 text-[13px] font-medium text-[#0D1526] outline-none transition focus:border-[#976224] focus:ring-2 focus:ring-[#976224]/15">
                      <option value="">Tous les formats</option>
                      {formats.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#0D1526]" size={17} aria-hidden="true" />
                  </span>
                </label>

                <div>
                  <label htmlFor="documents-search" className="mb-2 block text-[11px] font-bold text-[#0D1526]">Rechercher</label>
                  <div className="documents-filter-control flex h-12 items-center border border-[#D9D5CD] bg-white p-1 transition focus-within:border-[#976224] focus-within:ring-2 focus-within:ring-[#976224]/15">
                    <input
                      id="documents-search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      type="search"
                      placeholder="Rechercher..."
                      className="min-w-0 flex-1 border-0 bg-transparent px-2 text-[13px] font-medium text-[#0D1526] outline-none placeholder:font-normal placeholder:text-[#8B9099]"
                    />
                    {query && (
                      <button type="button" onClick={() => setQuery("")} className="flex h-8 w-8 flex-none items-center justify-center text-[#6B7280] transition hover:bg-[#F1EEE8] hover:text-[#0D1526]" aria-label="Effacer la recherche">
                        <X size={15} />
                      </button>
                    )}
                    <span className="flex h-10 w-10 flex-none items-center justify-center text-[#0D1526]" aria-hidden="true">
                      <Search size={18} strokeWidth={2.25} />
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="px-4 py-10 md:px-6">
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
          <div className="documents-library-table public-surface mx-auto max-w-6xl overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-[#E8E3D9] bg-[#FBFAF7] px-5 py-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
              <div className="flex items-center gap-3">
                <span className="documents-library-icon flex h-10 w-10 items-center justify-center bg-[#0D1526] text-white" aria-hidden="true">
                  <BookOpen size={19} />
                </span>
                <div>
                  <h2 className="text-[15px] font-bold text-[#0D1526]">Bibliothèque de documents</h2>
                  <p className="mt-0.5 text-[12px] text-[#6B7280]">Parcourez les modèles disponibles ou recherchez par mot-clé.</p>
                </div>
              </div>
              <span className="self-start rounded-full bg-[#F5E8D5] px-3 py-1.5 text-[11px] font-bold text-[#976224] sm:self-auto">
                {filteredGuides.length} document{filteredGuides.length !== 1 ? "s" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[#E8E3D9] bg-white text-[10px] font-bold uppercase tracking-[0.12em] text-[#8B9099]">
                    <th className="px-6 py-3.5">Document</th>
                    <th className="w-[220px] px-4 py-3.5">Catégorie</th>
                    <th className="w-[90px] px-4 py-3.5">Format</th>
                    <th className="w-[90px] px-4 py-3.5">Pages</th>
                    <th className="w-[150px] px-6 py-3.5 text-right"><span className="sr-only">Action</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEAE2]">
                  {filteredGuides.map((guide) => {
                    const slug = slugValue(guide.slug);
                    const href = slug ? `/ressources/documents/${encodeURIComponent(slug)}` : "/ressources/documents";

                    return (
                      <tr key={guide._id} className="group bg-white transition hover:bg-[#FCFAF6]">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3.5">
                            <span className="documents-file-icon flex h-11 w-11 flex-none items-center justify-center bg-[#F5E8D5] text-[#976224]" aria-hidden="true">
                              <FileText size={20} />
                            </span>
                            <div className="min-w-0">
                              <Link href={href} className="text-[13.5px] font-bold text-[#0D1526] transition hover:text-[#976224]">
                                {guide.title}
                              </Link>
                              {guide.description && <p className="mt-1 line-clamp-1 max-w-xl text-[11.5px] text-[#7B818B]">{guide.description}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {guide.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className="rounded-full bg-[#F4F1EB] px-2.5 py-1 text-[10.5px] font-semibold text-[#665E54]">{tag}</span>
                            ))}
                            {guide.tags.length > 2 && <span className="px-1 py-1 text-[10.5px] font-semibold text-[#8B9099]">+{guide.tags.length - 2}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[11.5px] font-bold text-[#6B7280]">{fileFormat(guide.fileUrl)}</td>
                        <td className="px-4 py-4 text-[11.5px] font-medium text-[#6B7280]">{guide.pages || "—"}</td>
                        <td className="px-6 py-4 text-right">
                          <Link href={href} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#976224] transition group-hover:text-[#0D1526]">
                            Consulter <ArrowRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredGuides.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-14 text-center">
                        <h3 className="text-[16px] font-bold text-[#0D1526]">Aucun document trouvé</h3>
                        <p className="mt-2 text-[12.5px] text-[#6B7280]">Essayez un autre mot-clé comme contrat, TVA, facture ou bail.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

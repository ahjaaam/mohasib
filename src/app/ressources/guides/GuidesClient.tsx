"use client";

import { useState } from "react";
import { CheckCircle, Download, FileText, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { DownloadableGuide } from "@/lib/guides";

function slugValue(slug: DownloadableGuide["slug"]) {
  return typeof slug === "string" ? slug : slug?.current ?? null;
}

function sourceFor(title: string) {
  return `document_${title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

function downloadGuide(guide: DownloadableGuide) {
  if (!guide.fileUrl) return;

  window.open(guide.fileUrl, "_blank", "noopener,noreferrer");
}

export default function GuidesClient({ guides }: { guides: DownloadableGuide[] }) {
  const supabase = createClient();
  const [selectedGuide, setSelectedGuide] = useState<DownloadableGuide | null>(null);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedGuide || !email.trim()) return;
    setSaving(true);
    const params = new URLSearchParams(window.location.search);
    const { error } = await supabase.from("resource_leads").insert({
      email: email.trim().toLowerCase(),
      resource_id: selectedGuide._id,
      resource_title: selectedGuide.title,
      resource_slug: slugValue(selectedGuide.slug),
      resource_type: "document",
      source: sourceFor(selectedGuide.title),
      page_path: window.location.pathname,
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      utm_term: params.get("utm_term"),
      referrer: document.referrer || null,
    });
    setSaving(false);
    if (error) return;
    downloadGuide(selectedGuide);
    setSuccess(true);
  }

  function closeModal() {
    setSelectedGuide(null);
    setEmail("");
    setSaving(false);
    setSuccess(false);
  }

  return (
    <>
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
          <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-2">
            {guides.map((guide) => (
              <article key={guide._id} className="rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white p-6 shadow-[0_10px_28px_rgba(13,21,38,0.05)]">
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
                <button
                  type="button"
                  onClick={() => setSelectedGuide(guide)}
                  disabled={!guide.fileUrl}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-[#C8924A] px-4 py-3 text-[13px] font-bold text-[#C8924A] transition hover:bg-[#C8924A] hover:text-white disabled:cursor-not-allowed disabled:border-[#D1D5DB] disabled:text-[#9CA3AF] disabled:hover:bg-transparent"
                >
                  <Download size={15} /> Ouvrir gratuitement
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[22px] font-bold text-[#0D1526]">Accédez gratuitement au document</h2>
                <p className="mt-2 text-[13px] leading-6 text-[#6B7280]">
                  Entrez votre email pour accéder au document :
                </p>
              </div>
              <button type="button" onClick={closeModal} className="rounded-md p-1 text-[#6B7280] hover:bg-[#F3F4F6]">
                <X size={18} />
              </button>
            </div>

            {success ? (
              <div className="mt-6 rounded-xl bg-[#ECFDF5] p-5 text-center">
                <CheckCircle className="mx-auto text-[#059669]" size={32} />
                <p className="mt-3 text-[14px] font-bold text-[#065F46]">Merci, votre document est prêt.</p>
                <p className="mt-2 text-[12px] leading-5 text-[#047857]">
                  Si l&apos;ouverture automatique a été bloquée par votre navigateur, utilisez le bouton ci-dessous.
                </p>
                <a
                  href={selectedGuide.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#059669] px-4 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#047857]"
                >
                  Ouvrir le document
                </a>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-6 space-y-4">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="votre@email.com"
                  className="w-full rounded-lg border border-[rgba(13,21,38,0.12)] px-3 py-3 text-[14px] outline-none focus:border-[#C8924A]"
                />
                <button
                  disabled={saving}
                  className="w-full rounded-lg bg-[#C8924A] px-4 py-3 text-[13px] font-bold text-white transition hover:bg-[#B7833F] disabled:opacity-60"
                >
                  {saving ? "Ouverture..." : "Accéder au document ->"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

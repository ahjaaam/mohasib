"use client";

import { useState } from "react";
import { CheckCircle, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type DocumentLeadFormProps = {
  resource: {
    id: string;
    title: string;
    slug?: string | null;
    fileUrl?: string | null;
  };
};

function sourceFor(title: string) {
  return `document_${title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

function openDocument(fileUrl?: string | null) {
  if (!fileUrl) return;
  window.open(fileUrl, "_blank", "noopener,noreferrer");
}

export default function DocumentLeadForm({ resource }: DocumentLeadFormProps) {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !resource.fileUrl) return;

    setSaving(true);
    setError("");
    const params = new URLSearchParams(window.location.search);
    const { error: insertError } = await supabase.from("resource_leads").insert({
      email: email.trim().toLowerCase(),
      phone: phone.trim() || null,
      resource_id: resource.id,
      resource_title: resource.title,
      resource_slug: resource.slug,
      resource_type: "document",
      source: sourceFor(resource.title),
      page_path: window.location.pathname,
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      utm_term: params.get("utm_term"),
      referrer: document.referrer || null,
    });
    setSaving(false);

    if (insertError) {
      setError("Impossible d'enregistrer votre email pour le moment. Réessayez dans quelques instants.");
      return;
    }

    void fetch("/api/resources/send-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        resourceId: resource.id,
      }),
      keepalive: true,
    }).catch((sendError) => {
      console.error("Document email failed", sendError);
    });

    openDocument(resource.fileUrl);
    setSuccess(true);
  }

  return (
    <div className="public-surface public-accent-surface p-6">
      <div className="public-icon-tile h-12 w-12">
        <Download size={24} />
      </div>
      <h2 className="mt-5 text-[22px] font-bold text-[#0D1526]">Télécharger gratuitement</h2>
      <p className="mt-2 text-[13.5px] leading-6 text-[#6B7280]">
        Entrez votre email pour accéder au document. Nous l&apos;utiliserons aussi pour vous envoyer des ressources utiles liées à la gestion d&apos;entreprise.
      </p>

      {success ? (
        <div className="mt-6 rounded-xl bg-[#ECFDF5] p-5 text-center">
          <CheckCircle className="mx-auto text-[#059669]" size={32} />
          <p className="mt-3 text-[14px] font-bold text-[#065F46]">Merci, votre document est prêt.</p>
          <p className="mt-2 text-[12px] leading-5 text-[#047857]">
            Nous vous envoyons aussi le lien par email. Si l&apos;ouverture automatique a été bloquée par votre navigateur, utilisez le bouton ci-dessous.
          </p>
          <a
            href={resource.fileUrl ?? "#"}
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
            className="w-full rounded-lg border border-[rgba(13,21,38,0.12)] px-3 py-3 text-[14px] outline-none focus:border-[#A89596]"
          />
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Téléphone (optionnel)"
            className="w-full rounded-lg border border-[rgba(13,21,38,0.12)] px-3 py-3 text-[14px] outline-none focus:border-[#A89596]"
          />
          {error && <p className="text-[12px] leading-5 text-red-600">{error}</p>}
          <button
            disabled={saving || !resource.fileUrl}
            className="public-primary-action w-full disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Ouverture..." : "Accéder au document ->"}
          </button>
          <p className="text-center text-[11.5px] leading-5 text-[#9CA3AF]">
            Pas de spam. Désabonnement en un clic.
          </p>
        </form>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenText, FileUp, RefreshCw } from "lucide-react";

type Source = {
  id: string;
  source_key: string;
  title: string;
  document_type: string;
  publisher: string;
  authority_level: number;
  language: string;
  canonical_url: string;
  document_reference: string | null;
  published_on: string | null;
  effective_from: string | null;
  effective_to: string | null;
  publication_status: string;
  ingestion_status: string;
  original_filename: string | null;
  page_count: number | null;
  chunk_count: number;
  last_verified_at: string | null;
  ingest_error: string | null;
  source_text?: string | null;
};

type Fields = {
  source_key: string;
  title: string;
  publisher: string;
  canonical_url: string;
  document_reference: string;
  document_type: string;
  authority_level: string;
  language: string;
  published_on: string;
  effective_from: string;
  effective_to: string;
  publication_status: string;
};

const EMPTY: Fields = {
  source_key: "", title: "", publisher: "", canonical_url: "", document_reference: "",
  document_type: "law", authority_level: "5", language: "fr", published_on: "",
  effective_from: "", effective_to: "", publication_status: "active",
};

const TYPES = [
  ["law", "Loi / code"], ["tax_code", "Code fiscal"], ["finance_law", "Loi de finances"],
  ["regulation", "Règlement / instruction"], ["administrative_guidance", "Guide administratif"],
  ["accounting_standard", "Norme comptable"], ["professional_guidance", "Guide professionnel"],
  ["academic", "Article académique"], ["other", "Autre"],
];

export default function AssistantSourcesManager() {
  const [sources, setSources] = useState<Source[]>([]);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"text" | "pdf">("text");
  const [content, setContent] = useState("");
  const [locator, setLocator] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [acquiring, setAcquiring] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkResults, setBulkResults] = useState<Array<{ sourceId: string; sourceKey?: string; title: string; status: string; chunkCount?: number; format?: string; message?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadSources() {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/assistant-sources", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Chargement impossible.");
      setSources(json.sources ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadSources(); }, []);

  const searchableCount = useMemo(() => sources.filter((source) => source.ingestion_status === "ready" && source.chunk_count > 0).length, [sources]);
  const notSearchableCount = useMemo(() => sources.filter((source) => source.ingestion_status !== "ready" || source.chunk_count < 1).length, [sources]);
  const indexOnlyCount = useMemo(() => sources.filter((source) => source.ingestion_status === "ready" && source.chunk_count > 0 && /\b(index|notice|portail)\b/i.test(`${source.title} ${source.document_reference ?? ""}`)).length, [sources]);

  function isIndexOnly(source: Source) {
    return /\b(index|notice|portail)\b/i.test(`${source.title} ${source.document_reference ?? ""}`);
  }

  function ingestionLabel(source: Source) {
    if (source.ingestion_status === "ready" && source.chunk_count > 0 && isIndexOnly(source)) return "Index · consultable";
    if (source.ingestion_status === "ready" && source.chunk_count > 0) return "Prête · consultable";
    if (source.ingestion_status === "ready") return "Incohérence · aucun passage";
    if (source.ingestion_status === "catalogued") return "Catalogue seulement · non consultable";
    if (source.ingestion_status === "processing") return "Indexation en cours";
    if (source.ingestion_status === "failed") return "Échec de l’indexation";
    return source.ingestion_status;
  }

  function ingestionClass(source: Source) {
    if (source.ingestion_status === "ready" && source.chunk_count > 0) return "bg-emerald-50 text-emerald-800";
    if (source.ingestion_status === "failed" || (source.ingestion_status === "ready" && source.chunk_count < 1)) return "bg-red-50 text-red-800";
    return "bg-amber-50 text-amber-900";
  }

  function indexingDetail(source: Source) {
    if (source.ingestion_status === "ready" && source.chunk_count > 0 && isIndexOnly(source)) return `${source.chunk_count} passages d’index consultables · ne remplace pas le texte intégral`;
    if (source.ingestion_status === "ready" && source.chunk_count > 0) return `${source.chunk_count} passages consultables${source.page_count ? ` · ${source.page_count} pages` : ""}`;
    if (source.ingestion_status === "ready") return "Aucun passage indexé : cette source ne peut pas répondre aux recherches.";
    if (source.ingestion_status === "catalogued") return "Aucun document ni passage indexé : cette référence ne participe pas aux réponses.";
    if (source.ingestion_status === "processing") return "Le document est en cours d’indexation.";
    if (source.ingestion_status === "failed") return `Non consultable · indexation échouée${source.chunk_count > 0 ? ` · ${source.chunk_count} anciens passages` : ""}`;
    return `${source.chunk_count} passages · statut ${source.ingestion_status}`;
  }

  async function chooseSource(sourceId: string) {
    const source = sources.find((item) => item.id === sourceId);
    if (!source) {
      setSelectedSourceId("");
      setFields(EMPTY);
      setContent("");
      setLocator("");
      return;
    }
    setSelectedSourceId(source.id);
    setFields({
      source_key: source.source_key,
      title: source.title,
      publisher: source.publisher,
      canonical_url: source.canonical_url,
      document_reference: source.document_reference ?? "",
      document_type: source.document_type,
      authority_level: String(source.authority_level),
      language: source.language,
      published_on: source.published_on ?? "",
      effective_from: source.effective_from ?? "",
      effective_to: source.effective_to ?? "",
      publication_status: source.publication_status,
    });
    try {
      const response = await fetch(`/api/admin/assistant-sources?sourceId=${encodeURIComponent(source.id)}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Impossible de charger le contenu.");
      setContent(json.source?.source_text ?? "");
      setLocator(source.document_reference ?? "");
      setMode("text");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Impossible de charger le contenu.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mode === "pdf" && !file) {
      setError("Sélectionnez le PDF de la source.");
      return;
    }
    if (mode === "text" && content.trim().length < 60) {
      setError("Ajoutez au moins 60 caractères de contenu source avant l’indexation.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const metadata = { ...fields, ...(mode === "text" ? { content, locator } : {}) };
      const form = new FormData();
      Object.entries(fields).forEach(([key, value]) => form.set(key, value));
      if (file) form.set("file", file);
      const response = mode === "text"
        ? await fetch("/api/admin/assistant-sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadata) })
        : await fetch("/api/admin/assistant-sources", { method: "POST", body: form });
      const json = await response.json();
      if (!response.ok) throw new Error(json.message || "Import impossible.");
      setMessage(`Contenu enregistré dans la bibliothèque et consultable par l’IA · ${json.chunkCount} passages indexés${json.pageCount ? ` · ${json.pageCount} pages` : ""}.`);
      setFile(null);
      setContent("");
      setLocator("");
      setFields(EMPTY);
      setSelectedSourceId("");
      setMode("text");
      await loadSources();
      const input = document.getElementById("assistant-source-pdf") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Import impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function acquireSources(ids: string[]) {
    if (!ids.length) return;
    setAcquiring(true);
    setBulkMessage("");
    setBulkResults([]);
    try {
      const allResults: typeof bulkResults = [];
      let readyCount = 0;
      for (let offset = 0; offset < ids.length; offset += 20) {
        const batchNumber = Math.floor(offset / 20) + 1;
        const batchCount = Math.ceil(ids.length / 20);
        setBulkMessage(`Récupération du lot ${batchNumber}/${batchCount}…`);
        const response = await fetch("/api/admin/assistant-sources/acquire", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceIds: ids.slice(offset, offset + 20) }),
        });
        const json = await response.json();
        if (!response.ok) throw new Error(json.message || "Acquisition impossible.");
        allResults.push(...(json.results ?? []));
        readyCount += Number(json.readyCount ?? 0);
        setBulkResults([...allResults]);
      }
      setBulkMessage(`${readyCount} source(s) récupérée(s) et indexée(s) · ${allResults.length - readyCount} échec(s).`);
      setSelectedIds([]);
      await loadSources();
    } catch (bulkError) {
      setBulkMessage(bulkError instanceof Error ? bulkError.message : "Acquisition impossible.");
    } finally {
      setAcquiring(false);
    }
  }

  function setField<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  const inputClass = "mt-1.5 h-10 w-full border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#C8924A]";
  const labelClass = "block text-xs font-medium text-slate-600";

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center bg-[#F4E8D7] text-[#805623]"><BookOpenText size={17} /></span>
          <div><h2 className="text-sm font-semibold text-[#0D1526]">Gérer le contenu de la bibliothèque IA</h2><p className="mt-0.5 text-xs text-slate-500">Enregistrez du texte source ou importez un PDF : le contenu indexé devient consultable par les réponses.</p></div>
        </div>

        <div className="mb-4 flex gap-2 border-b border-slate-100 pb-3">
          <button type="button" onClick={() => setMode("text")} className={`px-3 py-2 text-xs font-semibold ${mode === "text" ? "bg-[#F4E8D7] text-[#704B1D]" : "text-slate-500 hover:bg-slate-50"}`}>Texte source</button>
          <button type="button" onClick={() => setMode("pdf")} className={`px-3 py-2 text-xs font-semibold ${mode === "pdf" ? "bg-[#F4E8D7] text-[#704B1D]" : "text-slate-500 hover:bg-slate-50"}`}>Document PDF</button>
        </div>

        <div className="mb-5 grid gap-3 md:grid-cols-2">
          <label className={labelClass}>Créer ou modifier une source enregistrée
            <select className={inputClass} value={selectedSourceId} onChange={(event) => void chooseSource(event.target.value)}>
              <option value="">Nouvelle source…</option>
              {sources.map((source) => <option value={source.id} key={source.id}>{source.title} · {ingestionLabel(source)}</option>)}
            </select>
          </label>
          {mode === "pdf" && <label className={labelClass}>Fichier PDF · texte sélectionnable · 20 Mo maximum
            <input id="assistant-source-pdf" className={`${inputClass} py-2`} type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required />
          </label>}
        </div>

        {mode === "text" && <div className="mt-4 grid gap-3">
          <label className={labelClass}>Repère de citation (article, page ou section)<input className={inputClass} value={locator} onChange={(event) => setLocator(event.target.value)} placeholder="Ex. Article 4 · obligations comptables" /></label>
          <label className={labelClass}>Contenu à rendre consultable *
            <textarea className="mt-1.5 min-h-56 w-full border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-800 outline-none focus:border-[#C8924A]" value={content} onChange={(event) => setContent(event.target.value)} maxLength={480000} placeholder="Collez ici le texte de la source ou l’extrait vérifié. Après enregistrement, Mohasib le découpe en passages indexés et l’utilise dans la recherche." />
          </label>
          <p className="text-xs text-slate-500">{content.length.toLocaleString("fr-MA")} caractères · jusqu’à 480 000 caractères · enregistrer à nouveau remplace les passages de cette source.</p>
        </div>}

        <div className="grid gap-3 md:grid-cols-3">
          <label className={labelClass}>Titre *<input className={inputClass} required maxLength={240} value={fields.title} onChange={(event) => setField("title", event.target.value)} /></label>
          <label className={labelClass}>Éditeur / institution *<input className={inputClass} required maxLength={180} value={fields.publisher} onChange={(event) => setField("publisher", event.target.value)} /></label>
          <label className={labelClass}>Lien officiel HTTPS *<input className={inputClass} type="url" required value={fields.canonical_url} onChange={(event) => setField("canonical_url", event.target.value)} placeholder="https://…" /></label>
          <label className={labelClass}>Identifiant stable<input className={inputClass} value={fields.source_key} onChange={(event) => setField("source_key", event.target.value)} placeholder="cgi-2026" /></label>
          <label className={labelClass}>Référence du document<input className={inputClass} value={fields.document_reference} onChange={(event) => setField("document_reference", event.target.value)} placeholder="Loi n° …, article …" /></label>
          <label className={labelClass}>Type de document
            <select className={inputClass} value={fields.document_type} onChange={(event) => setField("document_type", event.target.value)}>{TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
          </label>
          <label className={labelClass}>Autorité de la source
            <select className={inputClass} value={fields.authority_level} onChange={(event) => setField("authority_level", event.target.value)}>
              <option value="5">5 · Texte / institution officielle</option><option value="4">4 · Guide officiel / ordre professionnel</option><option value="3">3 · Professionnel reconnu</option><option value="2">2 · Recherche secondaire</option><option value="1">1 · Contexte seulement</option>
            </select>
          </label>
          <label className={labelClass}>Langue
            <select className={inputClass} value={fields.language} onChange={(event) => setField("language", event.target.value)}><option value="fr">Français</option><option value="ar">العربية</option><option value="multi">Multiple</option><option value="en">English</option></select>
          </label>
          <label className={labelClass}>Statut juridique
            <select className={inputClass} value={fields.publication_status} onChange={(event) => setField("publication_status", event.target.value)}><option value="active">En vigueur / actuel</option><option value="superseded">Remplacé</option><option value="draft">Projet / brouillon</option><option value="repealed">Abrogé</option></select>
          </label>
          <label className={labelClass}>Publié le<input className={inputClass} type="date" value={fields.published_on} onChange={(event) => setField("published_on", event.target.value)} /></label>
          <label className={labelClass}>En vigueur à partir du<input className={inputClass} type="date" value={fields.effective_from} onChange={(event) => setField("effective_from", event.target.value)} /></label>
          <label className={labelClass}>En vigueur jusqu’au<input className={inputClass} type="date" value={fields.effective_to} onChange={(event) => setField("effective_to", event.target.value)} /></label>
        </div>

        {(error || message) && <div className={`mt-4 border px-3 py-2.5 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`} role="status">{error || message}</div>}
        <div className="mt-5 flex justify-end"><button disabled={saving} className="inline-flex h-10 items-center gap-2 bg-[#0D1526] px-4 text-sm font-semibold text-white disabled:opacity-50" type="submit">{saving ? <RefreshCw size={15} className="animate-spin" /> : mode === "pdf" ? <FileUp size={15} /> : <BookOpenText size={15} />}{saving ? "Enregistrement et indexation…" : mode === "pdf" ? "Importer le PDF et indexer" : "Enregistrer dans la bibliothèque et indexer"}</button></div>
      </form>

      <section className="border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2"><BookOpenText size={17} className="text-[#976224]" /><h2 className="text-sm font-semibold text-[#0D1526]">Sources enregistrées</h2></div>
          <button type="button" className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800" onClick={() => void loadSources()}><RefreshCw size={13} /> Actualiser</button>
        </div>
        {!loading && sources.length > 0 && <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs">
          <span className="font-semibold text-emerald-800">{searchableCount} consultables</span>
          {indexOnlyCount > 0 && <span className="font-medium text-slate-600">dont {indexOnlyCount} index / notices · sans texte intégral</span>}
          <span className="font-medium text-amber-900">{notSearchableCount} non consultables</span>
          <span className="text-slate-600">Les sources textuelles et les index sont signalés séparément. Une page de catalogue ne remplace pas le texte juridique complet.</span>
        </div>}
        {!loading && sources.length > 0 && <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-white px-5 py-3">
          <button type="button" className="text-xs font-medium text-[#805623] underline underline-offset-2" onClick={() => setSelectedIds(sources.filter((source) => source.ingestion_status !== "ready" || source.chunk_count < 1).map((source) => source.id))}>Sélectionner les non consultables</button>
          <button type="button" className="text-xs text-slate-500 underline underline-offset-2" onClick={() => setSelectedIds([])}>Tout désélectionner</button>
          <span className="text-xs text-slate-500">{selectedIds.length} sélectionnée(s)</span>
          <button type="button" disabled={!selectedIds.length || acquiring} className="ml-auto inline-flex h-9 items-center gap-2 bg-[#0D1526] px-3 text-xs font-semibold text-white disabled:opacity-50" onClick={() => void acquireSources(selectedIds)}>{acquiring ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}{acquiring ? "Récupération et indexation…" : "Récupérer les liens sélectionnés et indexer"}</button>
        </div>}
        {bulkMessage && <div className="border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm text-slate-700" role="status">{bulkMessage}</div>}
        {bulkResults.length > 0 && <ul className="divide-y divide-slate-100 border-b border-slate-100">{bulkResults.map((result) => <li className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-xs" key={result.sourceId}><span className="font-medium text-slate-700">{result.title} {result.sourceKey && <span className="font-normal text-slate-400">({result.sourceKey})</span>}</span><span className={result.status === "ready" ? "text-emerald-800" : "text-red-700"}>{result.status === "ready" ? `${result.chunkCount} passages · ${result.format} · consultable` : result.message || "Échec"}</span></li>)}</ul>}
        {loading ? <p className="px-5 py-8 text-sm text-slate-500">Chargement…</p> : sources.length === 0 ? <p className="px-5 py-8 text-sm text-slate-500">Aucune source enregistrée.</p> : (
          <div className="divide-y divide-slate-100">
            {sources.map((source) => <article className="flex flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between" key={source.id}>
              <div className="flex min-w-0 items-start gap-3">
                <input aria-label={`Sélectionner ${source.title}`} type="checkbox" checked={selectedIds.includes(source.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, source.id] : ids.filter((id) => id !== source.id))} className="mt-1 accent-[#976224]" />
                <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-slate-800">{source.title}</h3><span className={`px-2 py-0.5 text-[10px] font-semibold ${ingestionClass(source)}`}>{ingestionLabel(source)}</span><span className="text-[10px] text-slate-500">Statut juridique : {source.publication_status}</span></div>
                <p className="mt-1 truncate text-xs text-slate-500">{source.publisher} · {source.document_reference || source.source_key}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {source.last_verified_at ? `Source vérifiée le ${new Date(source.last_verified_at).toLocaleDateString("fr-MA")}` : "Source non vérifiée"}
                  {source.effective_from && ` · applicable dès le ${new Date(`${source.effective_from}T00:00:00`).toLocaleDateString("fr-MA")}`}
                  {source.effective_to && ` · jusqu’au ${new Date(`${source.effective_to}T00:00:00`).toLocaleDateString("fr-MA")}`}
                  {" · "}<a className="underline underline-offset-2" href={source.canonical_url} target="_blank" rel="noreferrer">Ouvrir la source officielle</a>
                </p>
                {source.ingest_error && <p className="mt-1 text-xs text-red-700">{source.ingest_error}</p>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-start gap-2 md:items-end"><div className="text-xs text-slate-600">{indexingDetail(source)} · autorité {source.authority_level}/5</div><button type="button" disabled={acquiring} className="text-xs font-medium text-[#805623] underline underline-offset-2 disabled:opacity-50" onClick={() => void acquireSources([source.id])}>Récupérer le lien et indexer</button></div>
            </article>)}
          </div>
        )}
      </section>
    </div>
  );
}

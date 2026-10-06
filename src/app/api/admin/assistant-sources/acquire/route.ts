import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";
import { ingestKnowledgePdf, saveKnowledgeText } from "@/lib/knowledge-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const MAX_BULK_SOURCES = 20;
const ALLOWED_HOSTS = [
  "finances.gov.ma", "justice.gov.ma", "adala.justice.gov.ma", "sgg.gov.ma", "oc.gov.ma", "cnss.ma",
  "social.gov.ma", "douane.gov.ma", "taxsummaries.pwc.com", "upsilon-consulting.com",
  "nexora-expertise.ma", "guide.izri.ma", "cndp.ma", "maroc.ma", "rabat.eregulations.org",
];

// These catalog entries used to point at a broad landing page. Pin ingestion to
// the exact official document instead; the final URL is stored with the source.
const VERIFIED_DOCUMENT_URLS: Record<string, string> = {
  "cgnc-cnc": "https://www.finances.gov.ma/Publication/depp/2010/7004_recettes_priv_annee25_11_210.pdf",
  "cgi-2026-ar": "https://www.finances.gov.ma/Publication/dgi/2025/CGI-2026-AR.pdf",
  // The official site is split into frames. This direct page contains the
  // actual consolidated code text; the frame wrapper is only a table of contents.
  "code-douanes-adii": "https://www.douane.gov.ma/code/Code_339_F.htm",
  "code-societes-5-96": "https://adala.justice.gov.ma/api/uploads/2024/03/26/LA%20SOCIETE%20EN%20NOM%20COLLECTIF-1711463631100.pdf",
  "code-travail": "https://adala.justice.gov.ma/api/uploads/2024/04/30/code%20du%20travail-1714463246806.pdf",
  "dgi-nc-737-lf2026": "https://www.finances.gov.ma/Publication/dgi/2026/NC737LF2026.pdf",
  "law-09-08-cndp": "https://www.cndp.ma/images/lois/Loi-09-08-Fr.pdf",
  "lf-2026": "https://www.finances.gov.ma/Publication/db/2025/BO_7465-bis_fr.pdf",
  "lf-2026-text": "https://www.finances.gov.ma/Publication/db/2025/BO_7465-bis_fr.pdf",
  // Reproduction of the law text with amendments from Law 44-03 indicated;
  // retain the non-official publisher and never present it as the BO original.
  "law-9-88-cnc": "https://rabat.eregulations.org/media/Maroc%20-%20Obligations%20comptables%20commercants.pdf",
};
const VERIFIED_DOCUMENT_REFERENCES: Record<string, string> = {
  "law-09-08-cndp": "Loi n° 09-08 (version française CNDP). Le décret n° 2-09-165 est un document distinct.",
  "law-9-88-cnc": "Dahir n° 1-92-138 · reproduction non officielle du texte de la loi n° 9-88 indiquant les modifications de la loi n° 44-03 · vérifier au BO/texte primaire avant décision.",
};
const VERIFIED_DOCUMENT_PUBLISHERS: Record<string, string> = {
  "law-9-88-cnc": "Cabinet Bassamat · reproduction consultée via eRegulations Maroc (non officielle)",
};
const VERIFIED_DOCUMENT_AUTHORITIES: Record<string, number> = {
  "law-9-88-cnc": 3,
};

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
};

function allowedUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const allowed = ALLOWED_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (url.protocol !== "https:" || !allowed || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("L’acquisition automatique est limitée aux domaines officiels et professionnels approuvés. Téléversez le PDF ou collez le texte pour cette source.");
  }
  return url;
}

async function fetchSource(urlValue: string) {
  let url = allowedUrl(urlValue);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(25_000),
      headers: { "User-Agent": "MohasibSourceIndexer/1.0 (+https://mohasib.app)" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location || redirects === 3) throw new Error("Trop de redirections ou redirection invalide.");
      url = allowedUrl(new URL(location, url).toString());
      continue;
    }
    if (!response.ok) throw new Error(`La page source a répondu avec le statut HTTP ${response.status}.`);
    const announcedLength = Number(response.headers.get("content-length") ?? 0);
    if (announcedLength > MAX_BYTES) {
      await response.body?.cancel();
      throw new Error("Le document source dépasse la limite de 20 Mo.");
    }
    const reader = response.body?.getReader();
    const parts: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BYTES) {
          await reader.cancel();
          throw new Error("Le document source dépasse la limite de 20 Mo.");
        }
        parts.push(value);
      }
    }
    const bytes = Buffer.concat(parts.map((part) => Buffer.from(part)), length);
    if (bytes.length < 100) throw new Error("La page source est vide ou trop courte.");
    return { bytes, contentType: response.headers.get("content-type")?.toLowerCase() ?? "", finalUrl: url.toString() };
  }
  throw new Error("Impossible de suivre la redirection de la source.");
}

function htmlToText(html: string) {
  const visible = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|form)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">");
  return visible.replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([\da-f]+);/gi, (_match, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/[\t\u00a0 ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

async function acquireSource(source: Source, userId: string) {
  const canonicalUrl = VERIFIED_DOCUMENT_URLS[source.source_key] ?? source.canonical_url;
  const sourceToAcquire = { ...source, canonical_url: canonicalUrl };
  const fetched = await fetchSource(canonicalUrl);
  const isPdf = fetched.bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (isPdf) {
    if (fetched.bytes.length > MAX_BYTES) throw new Error("Le PDF dépasse la limite de 20 Mo.");
    const file = new File([fetched.bytes], `${source.source_key}.pdf`, { type: "application/pdf" });
    const result = await ingestKnowledgePdf({
      file,
      userId,
      sourceKey: sourceToAcquire.source_key,
      title: sourceToAcquire.title,
      documentType: sourceToAcquire.document_type,
      publisher: VERIFIED_DOCUMENT_PUBLISHERS[source.source_key] ?? sourceToAcquire.publisher,
      authorityLevel: VERIFIED_DOCUMENT_AUTHORITIES[source.source_key] ?? sourceToAcquire.authority_level,
      language: sourceToAcquire.language,
      canonicalUrl: sourceToAcquire.canonical_url,
      documentReference: VERIFIED_DOCUMENT_REFERENCES[source.source_key] ?? sourceToAcquire.document_reference ?? undefined,
      publishedOn: sourceToAcquire.published_on ?? undefined,
      effectiveFrom: sourceToAcquire.effective_from ?? undefined,
      effectiveTo: sourceToAcquire.effective_to ?? undefined,
      publicationStatus: sourceToAcquire.publication_status,
    });
    return { sourceId: result.sourceId, chunkCount: result.chunkCount, pageCount: result.pageCount, format: "PDF", canonicalUrl };
  }
  if (fetched.bytes.length > MAX_HTML_BYTES) throw new Error("La page HTML dépasse la limite de 2 Mo. Téléversez le PDF officiel ou collez le texte vérifié.");
  if (!fetched.contentType.includes("text/html") && !fetched.contentType.includes("application/xhtml+xml") && !fetched.contentType.includes("text/plain")) {
    throw new Error("Le lien ne renvoie ni PDF ni page texte prise en charge.");
  }
  const rawText = fetched.contentType.includes("text/plain")
    ? fetched.bytes.toString("utf8")
    : htmlToText(new TextDecoder("utf-8", { fatal: false }).decode(fetched.bytes));
  const content = rawText.replace(/\u0000/g, " ").trim();
  if (content.length < 100) throw new Error("La page ne contient pas assez de texte indexable. Téléversez le PDF ou collez le texte source.");
  const result = await saveKnowledgeText({
    userId,
    sourceKey: source.source_key,
    title: source.title,
    documentType: source.document_type,
    publisher: VERIFIED_DOCUMENT_PUBLISHERS[source.source_key] ?? source.publisher,
    authorityLevel: VERIFIED_DOCUMENT_AUTHORITIES[source.source_key] ?? source.authority_level,
    language: source.language,
    canonicalUrl,
    documentReference: VERIFIED_DOCUMENT_REFERENCES[source.source_key] ?? source.document_reference ?? undefined,
    publishedOn: source.published_on ?? undefined,
    effectiveFrom: source.effective_from ?? undefined,
    effectiveTo: source.effective_to ?? undefined,
    publicationStatus: source.publication_status,
    locator: `Page web · récupérée le ${new Date().toISOString().slice(0, 10)}`,
    content,
  });
  return { sourceId: result.sourceId, chunkCount: result.chunkCount, format: "HTML", canonicalUrl };
}

export async function POST(request: Request) {
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;
  let sourceIds: string[];
  try {
    const body = await request.json();
    const rawIds: unknown[] = Array.isArray(body.sourceIds) ? body.sourceIds : [];
    sourceIds = [...new Set(rawIds.filter((id): id is string => typeof id === "string"))];
  } catch {
    return NextResponse.json({ message: "Sélection des sources invalide." }, { status: 400 });
  }
  if (!sourceIds.length || sourceIds.length > MAX_BULK_SOURCES || sourceIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id))) {
    return NextResponse.json({ message: `Sélectionnez entre 1 et ${MAX_BULK_SOURCES} sources.` }, { status: 400 });
  }
  const { data, error } = await admin!.from("knowledge_sources")
    .select("id,source_key,title,document_type,publisher,authority_level,language,canonical_url,document_reference,published_on,effective_from,effective_to,publication_status")
    .in("id", sourceIds);
  if (error) return NextResponse.json({ message: "Impossible de charger les sources sélectionnées." }, { status: 500 });
  const sources = (data ?? []) as Source[];
  const byId = new Map(sources.map((source) => [source.id, source]));
  const results = [];
  for (const id of sourceIds) {
    const source = byId.get(id);
    if (!source) {
      results.push({ sourceId: id, title: id, status: "failed", message: "Source introuvable." });
      continue;
    }
    try {
      const result = await acquireSource(source, user!.id);
      await logAdminAudit({
        adminEmail: user!.email ?? "",
        action: "KNOWLEDGE_SOURCE_ACQUIRE",
        entityType: "knowledge_source",
        entityId: result.sourceId,
        entityLabel: source.title,
        newValues: { chunk_count: result.chunkCount, format: result.format, canonical_url: result.canonicalUrl },
      });
      results.push({ sourceId: id, sourceKey: source.source_key, title: source.title, status: "ready", ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Échec de l’acquisition.";
      await admin!.from("knowledge_sources").update({
        ingestion_status: "failed",
        ingest_error: message,
        updated_at: new Date().toISOString(),
      }).eq("id", id);
      results.push({ sourceId: id, sourceKey: source.source_key, title: source.title, status: "failed", message });
    }
  }
  const readyCount = results.filter((item) => item.status === "ready").length;
  return NextResponse.json({ readyCount, failedCount: results.length - readyCount, results });
}

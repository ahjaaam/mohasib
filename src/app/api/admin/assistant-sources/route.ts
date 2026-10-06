import { NextResponse } from "next/server";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";
import { ingestKnowledgePdf, saveKnowledgeText } from "@/lib/knowledge-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DOCUMENT_TYPES = new Set([
  "law", "tax_code", "finance_law", "regulation", "administrative_guidance",
  "accounting_standard", "professional_guidance", "academic", "other",
]);
const LANGUAGES = new Set(["fr", "ar", "en", "multi"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_PDF_BYTES = 20 * 1024 * 1024;

function optionalDate(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  if (!DATE_RE.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) throw new Error("Une date de source est invalide.");
  return text;
}

export async function GET(request: Request) {
  const { admin, response } = await requireAdminApi();
  if (response) return response;
  const sourceId = new URL(request.url).searchParams.get("sourceId");
  if (sourceId) {
    const { data, error } = await admin!.from("knowledge_sources")
      .select("id,source_key,storage_path")
      .eq("id", sourceId)
      .maybeSingle();
    if (error || !data) return NextResponse.json({ message: "Source introuvable." }, { status: 404 });
    let sourceText = "";
    if (data.storage_path?.endsWith(".txt")) {
      const { data: file, error: downloadError } = await admin!.storage.from("mohasib-knowledge").download(data.storage_path);
      if (downloadError || !file) return NextResponse.json({ message: "Texte source introuvable dans le stockage." }, { status: 404 });
      sourceText = await file.text();
    }
    return NextResponse.json({ source: { id: data.id, source_key: data.source_key, source_text: sourceText } }, { headers: { "Cache-Control": "no-store" } });
  }
  const { data, error } = await admin!.from("knowledge_sources")
    .select("id,source_key,title,document_type,publisher,authority_level,language,canonical_url,document_reference,published_on,effective_from,effective_to,publication_status,ingestion_status,original_filename,page_count,chunk_count,last_verified_at,ingest_error,created_at")
    .order("authority_level", { ascending: false })
    .order("title")
    .limit(200);
  if (error) return NextResponse.json({ message: "Impossible de charger les sources." }, { status: 500 });
  return NextResponse.json({ sources: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;

  if (request.headers.get("content-type")?.includes("application/json")) {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Contenu de source invalide." }, { status: 400 });
    }
    const value = (key: string) => String(body[key] ?? "").trim();
    const title = value("title");
    const publisher = value("publisher");
    const canonicalUrl = value("canonical_url");
    const content = String(body.content ?? "").trim();
    const documentType = value("document_type");
    const language = value("language") || "fr";
    const authorityLevel = Number(body.authority_level ?? 3);
    const sourceKey = value("source_key");
    if (!title || title.length > 240 || !publisher || publisher.length > 180 || content.length < 60 || content.length > 480_000) {
      return NextResponse.json({ message: "Renseignez le titre, l’éditeur et au moins 60 caractères de contenu (480 000 maximum)." }, { status: 400 });
    }
    if (!DOCUMENT_TYPES.has(documentType) || !LANGUAGES.has(language) || !Number.isInteger(authorityLevel) || authorityLevel < 1 || authorityLevel > 5 || !["active", "superseded", "draft", "repealed"].includes(value("publication_status") || "active")) {
      return NextResponse.json({ message: "Type, langue ou niveau d’autorité invalide." }, { status: 400 });
    }
    if (sourceKey && !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(sourceKey)) {
      return NextResponse.json({ message: "Identifiant de source invalide." }, { status: 400 });
    }
    try {
      if (new URL(canonicalUrl).protocol !== "https:") throw new Error("url");
    } catch {
      return NextResponse.json({ message: "Le lien de référence doit être une URL HTTPS valide." }, { status: 400 });
    }
    try {
      const result = await saveKnowledgeText({
        userId: user!.id,
        sourceKey: sourceKey || undefined,
        title,
        publisher,
        canonicalUrl,
        documentReference: value("document_reference"),
        documentType,
        authorityLevel,
        language,
        publishedOn: optionalDate(value("published_on") || null),
        effectiveFrom: optionalDate(value("effective_from") || null),
        effectiveTo: optionalDate(value("effective_to") || null),
        publicationStatus: value("publication_status") || "active",
        locator: value("locator"),
        content,
      });
      await logAdminAudit({
        adminEmail: user!.email ?? "",
        action: "KNOWLEDGE_SOURCE_TEXT_SAVE",
        entityType: "knowledge_source",
        entityId: result.sourceId,
        entityLabel: title,
        newValues: { chunk_count: result.chunkCount, source_key: sourceKey || null },
      });
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "L’indexation a échoué.";
      return NextResponse.json({ message }, { status: 422 });
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "Formulaire d’import invalide." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 100 || file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ message: "Choisissez un PDF de moins de 20 Mo." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.slice(0, 5).arrayBuffer());
  if (bytes.toString("ascii") !== "%PDF-") return NextResponse.json({ message: "Le fichier sélectionné n’est pas un PDF valide." }, { status: 400 });

  const title = String(form.get("title") ?? "").trim();
  const publisher = String(form.get("publisher") ?? "").trim();
  const canonicalUrl = String(form.get("canonical_url") ?? "").trim();
  const documentType = String(form.get("document_type") ?? "");
  const language = String(form.get("language") ?? "fr");
  const authorityLevel = Number(form.get("authority_level") ?? 3);
  const sourceKey = String(form.get("source_key") ?? "").trim();

  if (!title || title.length > 240 || !publisher || publisher.length > 180) {
    return NextResponse.json({ message: "Le titre et l’éditeur sont obligatoires." }, { status: 400 });
  }
  if (!DOCUMENT_TYPES.has(documentType) || !LANGUAGES.has(language) || !Number.isInteger(authorityLevel) || authorityLevel < 1 || authorityLevel > 5) {
    return NextResponse.json({ message: "Type, langue ou niveau d’autorité invalide." }, { status: 400 });
  }
  if (sourceKey && !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(sourceKey)) {
    return NextResponse.json({ message: "Identifiant de source invalide." }, { status: 400 });
  }
  try {
    const parsedUrl = new URL(canonicalUrl);
    if (parsedUrl.protocol !== "https:") throw new Error("url");
  } catch {
    return NextResponse.json({ message: "Le lien de référence doit être une URL HTTPS valide." }, { status: 400 });
  }

  try {
    const result = await ingestKnowledgePdf({
      file,
      userId: user!.id,
      sourceKey: sourceKey || undefined,
      title,
      publisher,
      documentType,
      authorityLevel,
      language,
      canonicalUrl,
      documentReference: String(form.get("document_reference") ?? "").trim(),
      publishedOn: optionalDate(form.get("published_on")),
      effectiveFrom: optionalDate(form.get("effective_from")),
      effectiveTo: optionalDate(form.get("effective_to")),
      publicationStatus: String(form.get("publication_status") ?? "active"),
    });
    await logAdminAudit({
      adminEmail: user!.email ?? "",
      action: "KNOWLEDGE_SOURCE_INGEST",
      entityType: "knowledge_source",
      entityId: result.sourceId,
      entityLabel: title,
      newValues: { page_count: result.pageCount, chunk_count: result.chunkCount, language },
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    console.error("[assistant-sources] ingestion failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ message: error instanceof Error ? error.message : "L’indexation a échoué." }, { status: 422 });
  }
}

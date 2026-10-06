import "server-only";
import { createHash } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_CHUNK_CHARS = 2_400;
const CHUNK_OVERLAP_CHARS = 280;
const CHUNK_INSERT_SIZE = 100;

export type KnowledgeSource = {
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
  created_at: string;
};

function splitPage(text: string, pageNumber: number) {
  const normalized = text.replace(/\r/g, "\n").replace(/[\t\u00a0 ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];

  const chunks: Array<{ locator: string; content: string }> = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + MAX_CHUNK_CHARS, normalized.length);
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf("\n\n", end), normalized.lastIndexOf(". ", end), normalized.lastIndexOf("; ", end));
      if (boundary > start + MAX_CHUNK_CHARS * 0.55) end = boundary + 1;
    }
    const content = normalized.slice(start, end).trim();
    if (content.length > 60) {
      const article = content.match(/\b(?:Article|Art\.)\s*(?:premier|\d+(?:\s*(?:bis|ter|quater))?)\b/i)
        ?? content.match(/المادة\s*[0-9٠-٩]+(?:\s*مكرر)?/u);
      chunks.push({ locator: `Page ${pageNumber}${article ? ` · ${article[0]}` : ""}`, content });
    }
    if (end >= normalized.length) break;
    start = Math.max(start + 1, end - CHUNK_OVERLAP_CHARS);
  }
  return chunks;
}

export async function ingestKnowledgePdf(input: {
  file: File;
  userId: string;
  sourceKey?: string;
  title: string;
  documentType: string;
  publisher: string;
  authorityLevel: number;
  language: string;
  canonicalUrl: string;
  documentReference?: string;
  publishedOn?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  publicationStatus?: string;
}): Promise<{ sourceId: string; pageCount: number; chunkCount: number }> {
  const admin = createAdminClient();
  const bytes = Buffer.from(await input.file.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const parser = new PDFParse({ data: bytes });

  let pageChunks: Array<{ locator: string; content: string }> = [];
  let pageCount = 0;
  try {
    const result = await parser.getText();
    pageCount = result.pages.length;
    pageChunks = result.pages.flatMap((page) => splitPage(page.text, page.num));
  } finally {
    await parser.destroy();
  }

  if (!pageChunks.length) {
    throw new Error("Aucun texte exploitable détecté. Ce PDF est peut-être un scan sans couche texte.");
  }

  const sourceKey = input.sourceKey?.trim() || `upload-${sha256.slice(0, 20)}`;
  const storagePath = `${sourceKey}/${sha256}.pdf`;
  const { error: uploadError } = await admin.storage.from("mohasib-knowledge").upload(storagePath, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) throw new Error("Impossible d’enregistrer le PDF dans la bibliothèque.");

  const { data: existing } = await admin.from("knowledge_sources").select("id,storage_path").eq("source_key", sourceKey).maybeSingle();
  const sourceValues = {
    source_key: sourceKey,
    title: input.title.trim(),
    document_type: input.documentType,
    publisher: input.publisher.trim(),
    authority_level: input.authorityLevel,
    language: input.language,
    canonical_url: input.canonicalUrl,
    document_reference: input.documentReference?.trim() || null,
    published_on: input.publishedOn || null,
    effective_from: input.effectiveFrom || null,
    effective_to: input.effectiveTo || null,
    publication_status: input.publicationStatus || "active",
    ingestion_status: "processing",
    storage_path: storagePath,
    original_filename: input.file.name.slice(0, 255),
    content_sha256: sha256,
    page_count: pageCount,
    chunk_count: 0,
    ingest_error: null,
    created_by: input.userId,
    updated_at: new Date().toISOString(),
  };

  const sourceResult = existing?.id
    ? await admin.from("knowledge_sources").update(sourceValues).eq("id", existing.id).select("id").single()
    : await admin.from("knowledge_sources").insert(sourceValues).select("id").single();
  if (sourceResult.error || !sourceResult.data) {
    await admin.storage.from("mohasib-knowledge").remove([storagePath]);
    throw new Error("Impossible d’enregistrer les métadonnées de la source.");
  }
  const sourceId = sourceResult.data.id;

  try {
    await admin.from("knowledge_chunks").delete().eq("source_id", sourceId);
    for (let offset = 0; offset < pageChunks.length; offset += CHUNK_INSERT_SIZE) {
      const batch = pageChunks.slice(offset, offset + CHUNK_INSERT_SIZE).map((chunk, index) => ({
        source_id: sourceId,
        chunk_index: offset + index,
        locator: chunk.locator,
        content: chunk.content,
      }));
      const { error } = await admin.from("knowledge_chunks").insert(batch);
      if (error) throw error;
    }
    const { error } = await admin.from("knowledge_sources").update({
      ingestion_status: "ready",
      chunk_count: pageChunks.length,
      last_verified_at: new Date().toISOString(),
      ingest_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", sourceId);
    if (error) throw error;
  } catch (error) {
    await admin.from("knowledge_sources").update({
      ingestion_status: "failed",
      ingest_error: "Échec de l’indexation des extraits.",
      updated_at: new Date().toISOString(),
    }).eq("id", sourceId);
    throw error;
  }

  if (existing?.storage_path && existing.storage_path !== storagePath) {
    await admin.storage.from("mohasib-knowledge").remove([existing.storage_path]).catch(() => undefined);
  }

  return { sourceId, pageCount, chunkCount: pageChunks.length };
}

export async function saveKnowledgeText(input: {
  userId: string;
  sourceKey?: string;
  title: string;
  documentType: string;
  publisher: string;
  authorityLevel: number;
  language: string;
  canonicalUrl: string;
  documentReference?: string;
  publishedOn?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  publicationStatus?: string;
  locator?: string;
  content: string;
}): Promise<{ sourceId: string; chunkCount: number }> {
  const content = input.content.replace(/\r/g, "\n").trim();
  const pageChunks = splitPage(content, 1).map((chunk, index) => ({
    locator: input.locator?.trim()
      ? `${input.locator.trim()} · Passage ${index + 1}`
      : `Texte source · Passage ${index + 1}`,
    content: chunk.content,
  }));
  if (!pageChunks.length) throw new Error("Le texte est trop court ou ne contient aucun passage exploitable.");
  if (pageChunks.length > 200) throw new Error("Le texte dépasse la limite de 200 passages par source.");

  const admin = createAdminClient();
  const sourceKey = input.sourceKey?.trim() || `source-${createHash("sha256").update(`${input.canonicalUrl}\n${input.title}`).digest("hex").slice(0, 20)}`;
  const { data: existing } = await admin.from("knowledge_sources")
    .select("id,storage_path,original_filename")
    .eq("source_key", sourceKey)
    .maybeSingle();
  const sourceValues = {
    source_key: sourceKey,
    title: input.title.trim(),
    document_type: input.documentType,
    publisher: input.publisher.trim(),
    authority_level: input.authorityLevel,
    language: input.language,
    canonical_url: input.canonicalUrl,
    document_reference: input.documentReference?.trim() || null,
    published_on: input.publishedOn || null,
    effective_from: input.effectiveFrom || null,
    effective_to: input.effectiveTo || null,
    publication_status: input.publicationStatus || "active",
    ingestion_status: "processing",
    content_sha256: createHash("sha256").update(content).digest("hex"),
    storage_path: `${sourceKey}/${createHash("sha256").update(content).digest("hex")}.txt`,
    original_filename: `${sourceKey}.txt`,
    page_count: null,
    chunk_count: 0,
    ingest_error: null,
    created_by: input.userId,
    updated_at: new Date().toISOString(),
  };

  const sourceStoragePath = sourceValues.storage_path;
  const { error: bucketError } = await admin.storage.updateBucket("mohasib-knowledge", {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
    allowedMimeTypes: ["application/pdf", "text/plain"],
  });
  if (bucketError) throw new Error("Impossible de préparer le stockage du texte source.");
  const { error: uploadError } = await admin.storage.from("mohasib-knowledge").upload(sourceStoragePath, Buffer.from(content, "utf8"), {
    contentType: "text/plain; charset=utf-8",
    upsert: true,
  });
  if (uploadError) throw new Error("Impossible d’enregistrer le texte source dans la bibliothèque.");

  const sourceResult = existing?.id
    ? await admin.from("knowledge_sources").update(sourceValues).eq("id", existing.id).select("id").single()
    : await admin.from("knowledge_sources").insert(sourceValues).select("id").single();
  if (sourceResult.error || !sourceResult.data) {
    await admin.storage.from("mohasib-knowledge").remove([sourceStoragePath]);
    throw new Error("Impossible d’enregistrer les métadonnées de la source.");
  }
  const sourceId = sourceResult.data.id;

  try {
    const { error: deleteError } = await admin.from("knowledge_chunks").delete().eq("source_id", sourceId);
    if (deleteError) throw deleteError;
    for (let offset = 0; offset < pageChunks.length; offset += CHUNK_INSERT_SIZE) {
      const batch = pageChunks.slice(offset, offset + CHUNK_INSERT_SIZE).map((chunk, index) => ({
        source_id: sourceId,
        chunk_index: offset + index,
        locator: chunk.locator,
        content: chunk.content,
      }));
      const { error } = await admin.from("knowledge_chunks").insert(batch);
      if (error) throw error;
    }
    const { error } = await admin.from("knowledge_sources").update({
      ingestion_status: "ready",
      chunk_count: pageChunks.length,
      last_verified_at: new Date().toISOString(),
      ingest_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", sourceId);
    if (error) throw error;
  } catch (error) {
    await admin.from("knowledge_sources").update({
      ingestion_status: "failed",
      ingest_error: "Échec de l’indexation du contenu texte.",
      updated_at: new Date().toISOString(),
    }).eq("id", sourceId);
    throw error;
  }

  if (existing?.storage_path && existing.storage_path !== sourceStoragePath) {
    await admin.storage.from("mohasib-knowledge").remove([existing.storage_path]).catch(() => undefined);
  }
  return { sourceId, chunkCount: pageChunks.length };
}

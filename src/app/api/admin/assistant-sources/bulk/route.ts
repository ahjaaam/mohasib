import { NextResponse } from "next/server";
import JSZip from "jszip";
import { requireAdminApi, logAdminAudit } from "@/lib/admin-api";
import { ingestKnowledgePdf } from "@/lib/knowledge-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ARCHIVE_BYTES = 100 * 1024 * 1024;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_BATCH_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
const MAX_FILES = 30;
type BulkSource = {
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

export async function POST(request: Request) {
  const { user, admin, response } = await requireAdminApi();
  if (response) return response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "Archive invalide." }, { status: 400 });
  }
  const archive = form.get("file");
  if (!(archive instanceof File) || archive.size < 100 || archive.size > MAX_ARCHIVE_BYTES) {
    return NextResponse.json({ message: "Choisissez un ZIP de moins de 100 Mo." }, { status: 400 });
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await archive.arrayBuffer());
  } catch {
    return NextResponse.json({ message: "Le fichier ZIP ne peut pas être lu." }, { status: 400 });
  }
  const pdfs = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".pdf"));
  if (!pdfs.length || pdfs.length > MAX_FILES) {
    return NextResponse.json({ message: `L’archive doit contenir entre 1 et ${MAX_FILES} PDF.` }, { status: 400 });
  }
  const declaredSizes = pdfs.map((entry) => (entry as typeof entry & { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0);
  if (declaredSizes.some((size) => size > MAX_SOURCE_BYTES) || declaredSizes.reduce((sum, size) => sum + size, 0) > MAX_BATCH_UNCOMPRESSED_BYTES) {
    return NextResponse.json({ message: "Un PDF dépasse 20 Mo ou l’ensemble dépasse 200 Mo décompressés." }, { status: 400 });
  }

  const keys = pdfs.map((entry) => entry.name.split("/").pop()!.replace(/\.pdf$/i, ""));
  if (new Set(keys).size !== keys.length || keys.some((key) => !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(key))) {
    return NextResponse.json({ message: "Chaque PDF doit avoir un nom unique correspondant à un identifiant de source, par exemple cnc-avis-1-2.pdf." }, { status: 400 });
  }
  const { data: sources, error: sourceError } = await admin!.from("knowledge_sources")
    .select("id,source_key,title,document_type,publisher,authority_level,language,canonical_url,document_reference,published_on,effective_from,effective_to,publication_status")
    .in("source_key", keys);
  if (sourceError) return NextResponse.json({ message: "Impossible de charger les sources du catalogue." }, { status: 500 });
  const sourceByKey = new Map<string, BulkSource>(((sources ?? []) as BulkSource[]).map((source) => [source.source_key, source]));

  const results: Array<{ sourceKey: string; title: string; status: "ready" | "failed"; chunkCount?: number; pageCount?: number; message?: string }> = [];
  for (const entry of pdfs) {
    const sourceKey = entry.name.split("/").pop()!.replace(/\.pdf$/i, "");
    const source = sourceByKey.get(sourceKey);
    if (!source) {
      results.push({ sourceKey, title: sourceKey, status: "failed", message: "Aucune source avec cet identifiant dans le catalogue." });
      continue;
    }
    try {
      const bytes = await entry.async("uint8array");
      if (bytes.byteLength < 100 || bytes.byteLength > MAX_SOURCE_BYTES || Buffer.from(bytes).subarray(0, 5).toString("ascii") !== "%PDF-") {
        throw new Error("PDF invalide ou supérieur à 20 Mo.");
      }
      const file = new File([new Uint8Array(bytes)], `${sourceKey}.pdf`, { type: "application/pdf" });
      const result = await ingestKnowledgePdf({
        file,
        userId: user!.id,
        sourceKey,
        title: source.title,
        documentType: source.document_type,
        publisher: source.publisher,
        authorityLevel: source.authority_level,
        language: source.language,
        canonicalUrl: source.canonical_url,
        documentReference: source.document_reference ?? undefined,
        publishedOn: source.published_on ?? undefined,
        effectiveFrom: source.effective_from ?? undefined,
        effectiveTo: source.effective_to ?? undefined,
        publicationStatus: source.publication_status,
      });
      await logAdminAudit({
        adminEmail: user!.email ?? "",
        action: "KNOWLEDGE_SOURCE_INGEST",
        entityType: "knowledge_source",
        entityId: result.sourceId,
        entityLabel: source.title,
        newValues: { page_count: result.pageCount, chunk_count: result.chunkCount, language: source.language, bulk: true },
      });
      results.push({ sourceKey, title: source.title, status: "ready", chunkCount: result.chunkCount, pageCount: result.pageCount });
    } catch (error) {
      results.push({ sourceKey, title: source.title, status: "failed", message: error instanceof Error ? error.message : "Échec de l’indexation." });
    }
  }

  const readyCount = results.filter((item) => item.status === "ready").length;
  return NextResponse.json({ ok: readyCount > 0, readyCount, failedCount: results.length - readyCount, results });
}

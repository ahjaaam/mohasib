import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";

export type CreateDocumentInput = {
  companyId?: string | null;
  dossierId?: string | null;
  documentNumber?: string | null;
  documentType: string;
  documentCategory?: string | null;
  source: string;
  fileUrl: string;
  fileName: string;
  fileType?: string | null;
  fileHash?: string | null;
  extractedData?: Record<string, unknown> | null;
  extractionConfidence?: number | null;
  documentDate?: string | null;
  dueDate?: string | null;
  periodMois?: number | null;
  periodAnnee?: number | null;
  amountHt?: number | null;
  amountTva?: number | null;
  amountTtc?: number | null;
  counterpartName?: string | null;
};

type LinkTarget =
  | "invoice"
  | "transaction"
  | "tva_declaration"
  | "bulletin_paie"
  | "ecriture"
  | "employee";

const LINK_COLUMNS: Record<LinkTarget, string> = {
  invoice: "invoice_id",
  transaction: "transaction_id",
  tva_declaration: "tva_declaration_id",
  bulletin_paie: "bulletin_paie_id",
  ecriture: "ecriture_id",
  employee: "employee_id",
};

export async function computeFileHash(buffer: Buffer | Uint8Array): Promise<string> {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function createDocument(input: CreateDocumentInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .insert({
      company_id: input.companyId ?? null,
      dossier_id: input.dossierId ?? null,
      document_number: input.documentNumber ?? null,
      document_type: input.documentType,
      document_category: input.documentCategory ?? null,
      source: input.source,
      file_url: input.fileUrl,
      file_name: input.fileName,
      file_type: input.fileType ?? null,
      file_hash: input.fileHash ?? null,
      extracted_data: input.extractedData ?? null,
      extraction_confidence: input.extractionConfidence ?? null,
      document_date: input.documentDate ?? null,
      due_date: input.dueDate ?? null,
      period_mois: input.periodMois ?? null,
      period_annee: input.periodAnnee ?? null,
      amount_ht: input.amountHt ?? null,
      amount_tva: input.amountTva ?? null,
      amount_ttc: input.amountTtc ?? null,
      counterpart_name: input.counterpartName ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function linkDocument(
  documentId: string,
  linkType: string,
  entityType: LinkTarget,
  entityId: string,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("document_links").insert({
    document_id: documentId,
    link_type: linkType,
    [LINK_COLUMNS[entityType]]: entityId,
  });
  if (error) throw new Error(error.message);
}

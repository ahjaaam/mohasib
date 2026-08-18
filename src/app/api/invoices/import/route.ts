import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizePermission } from "@/lib/api-permissions";
import { resolveAccountOwnerId } from "@/lib/account-owner";
import { extractClientInvoiceData } from "@/lib/client-invoice-import";
import { getAvailableInvoiceDocumentNumber } from "@/lib/document-numbers";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(["pdf", "jpg", "jpeg", "png", "webp", "xls", "xlsx", "docx"]);
const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function fileStem(name: string) {
  return name.replace(/\.[^.]+$/, "").trim().slice(0, 100);
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const dossierValue = form.get("dossierId");
  const dossierId = typeof dossierValue === "string" && dossierValue ? dossierValue : null;
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Sélectionnez une facture." }, { status: 400 });
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(extension)) return NextResponse.json({ error: "Format non accepté. Utilisez PDF, Word (.docx), Excel ou une image." }, { status: 415 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Le fichier dépasse 20 Mo." }, { status: 413 });

  const permission = await authorizePermission("invoice", "create", { dossierId });
  if (permission.response || !permission.user) return permission.response;
  const ownerId = await resolveAccountOwnerId(permission.user.id);
  const admin = createAdminClient();
  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = MIME_BY_EXTENSION[extension] ?? file.type;
  let storagePath: string | null = null;
  let documentId: string | null = null;
  let autoCreatedClientId: string | null = null;

  try {
    const extracted = await extractClientInvoiceData(bytes, mimeType, file.name).catch(() => null);
    const preferredNumber = extracted?.invoiceNumber || fileStem(file.name);
    const invoiceNumber = await getAvailableInvoiceDocumentNumber(admin, {
      preferredNumber,
      prefix: "FAC",
      userId: ownerId,
      dossierId,
    });

    let clientId: string | null = null;
    let clientCreated = false;
    if (extracted?.clientName) {
      let clientQuery = admin.from("clients").select("id").ilike("name", extracted.clientName).limit(1);
      clientQuery = dossierId ? clientQuery.eq("dossier_id", dossierId) : clientQuery.eq("user_id", ownerId).is("dossier_id", null);
      const { data: clients } = await clientQuery;
      clientId = clients?.[0]?.id ?? null;
      if (!clientId) {
        const { data: createdClient, error: clientError } = await admin.from("clients").insert({
          user_id: ownerId,
          dossier_id: dossierId,
          name: extracted.clientName,
          notes: `Créé automatiquement depuis l’import de ${file.name} — informations à vérifier`,
        }).select("id").single();
        if (clientError || !createdClient) throw clientError ?? new Error("Client non créé");
        clientId = createdClient.id;
        autoCreatedClientId = createdClient.id;
        clientCreated = true;
      }
    }

    const scope = dossierId ? `dossiers/${dossierId}` : "main";
    storagePath = `${ownerId}/${scope}/client-invoices/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await admin.storage.from("company-documents").upload(storagePath, bytes, {
      contentType: mimeType,
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: document, error: documentError } = await admin.from("company_documents").insert({
      user_id: ownerId,
      dossier_id: dossierId,
      name: `Facture client — ${invoiceNumber}`,
      document_category: "Facture client",
      storage_path: storagePath,
      storage_provider: "supabase",
      file_name: file.name,
      mime_type: mimeType,
      notes: "Importée depuis Factures clients",
    }).select("id").single();
    if (documentError || !document) throw documentError ?? new Error("Document non créé");
    documentId = document.id;

    const issueDate = extracted?.issueDate ?? new Date().toISOString().slice(0, 10);
    const subtotal = extracted?.subtotal ?? 0;
    const taxAmount = extracted?.taxAmount ?? 0;
    const total = extracted?.total ?? subtotal + taxAmount;
    const { data: invoice, error: invoiceError } = await admin.from("invoices").insert({
      user_id: ownerId,
      dossier_id: dossierId,
      client_id: clientId,
      invoice_number: invoiceNumber,
      invoice_type: "facture",
      status: "draft",
      issue_date: issueDate,
      due_date: extracted?.dueDate ?? null,
      subtotal,
      tax_rate: extracted?.taxRate ?? 0,
      tax_amount: taxAmount,
      total,
      currency: extracted?.currency ?? "MAD",
      notes: extracted?.notes ?? `Importée depuis ${file.name}`,
      items: [],
      source_document_id: documentId,
      import_source: "bulk_upload",
    }).select("id,invoice_number,total,status").single();
    if (invoiceError || !invoice) throw invoiceError ?? new Error("Facture non créée");

    return NextResponse.json({ invoice, extracted: Boolean(extracted), clientCreated }, { status: 201 });
  } catch (error) {
    if (documentId) {
      try { await admin.from("company_documents").delete().eq("id", documentId); } catch { /* best-effort cleanup */ }
    }
    if (storagePath) await admin.storage.from("company-documents").remove([storagePath]).catch(() => undefined);
    if (autoCreatedClientId) {
      try { await admin.from("clients").delete().eq("id", autoCreatedClientId); } catch { /* best-effort cleanup */ }
    }
    const message = error instanceof Error ? error.message : "Import impossible.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

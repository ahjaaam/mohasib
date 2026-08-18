import Anthropic from "@anthropic-ai/sdk";
import JSZip from "jszip";
import * as XLSX from "xlsx";

export interface ImportedClientInvoiceData {
  invoiceNumber: string | null;
  clientName: string | null;
  issueDate: string | null;
  dueDate: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  notes: string | null;
}

const anthropic = new Anthropic();

const PROMPT = `You extract data from client invoices issued by a Moroccan business. The issuer is the user; identify the CUSTOMER/recipient, not the issuing company.

Return only JSON with these fields:
{
  "invoice_number": "string or null",
  "client_name": "string or null",
  "issue_date": "YYYY-MM-DD or null",
  "due_date": "YYYY-MM-DD or null",
  "subtotal": 0,
  "tax_rate": 0,
  "tax_amount": 0,
  "total": 0,
  "currency": "MAD",
  "notes": "short description or null"
}

Rules: never invent a value; amounts must be numbers; prefer the displayed invoice number; customer names usually follow Client, Facturé à, Destinataire, À, Bill to, or Customer.`;

function finiteMoney(value: unknown) {
  const parsed = typeof value === "string"
    ? Number(value.replace(/\s/g, "").replace(",", "."))
    : Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(Math.abs(parsed) * 100) / 100 : 0;
}

function nullableText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
}

function isoDate(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dmy = text.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}` : null;
}

export function normalizeClientInvoiceExtraction(raw: Record<string, unknown>): ImportedClientInvoiceData {
  const total = finiteMoney(raw.total ?? raw.amount_ttc);
  let taxAmount = finiteMoney(raw.tax_amount ?? raw.tva_amount);
  let subtotal = finiteMoney(raw.subtotal ?? raw.amount_ht);
  let taxRate = finiteMoney(raw.tax_rate ?? raw.tva_rate);

  if (!subtotal && total) subtotal = Math.max(0, total - taxAmount);
  if (!taxAmount && total > subtotal) taxAmount = Math.max(0, total - subtotal);
  if (!taxRate && subtotal > 0 && taxAmount > 0) taxRate = Math.round((taxAmount / subtotal) * 10000) / 100;

  return {
    invoiceNumber: nullableText(raw.invoice_number),
    clientName: nullableText(raw.client_name ?? raw.customer_name),
    issueDate: isoDate(raw.issue_date ?? raw.date),
    dueDate: isoDate(raw.due_date),
    subtotal,
    taxRate,
    taxAmount,
    total: total || Math.round((subtotal + taxAmount) * 100) / 100,
    currency: nullableText(raw.currency)?.toUpperCase().slice(0, 3) || "MAD",
    notes: nullableText(raw.notes ?? raw.description),
  };
}

function parseJson(text: string) {
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end < start) return {};
  try { return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>; }
  catch { return {}; }
}

async function spreadsheetText(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  return workbook.SheetNames.slice(0, 5).map(name => {
    const sheet = workbook.Sheets[name];
    return sheet ? `Feuille ${name}\n${XLSX.utils.sheet_to_csv(sheet)}` : "";
  }).join("\n").slice(0, 40_000);
}

async function docxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")?.async("string") ?? "";
  return xml
    .replace(/<w:tab[^>]*\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 40_000);
}

export async function extractClientInvoiceData(buffer: Buffer, mimeType: string, fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  const isSpreadsheet = ["xls", "xlsx"].includes(extension ?? "");
  const isDocx = extension === "docx";
  let content: any[];

  if (isSpreadsheet || isDocx) {
    const text = isSpreadsheet ? await spreadsheetText(buffer) : await docxText(buffer);
    content = [{ type: "text", text: `${PROMPT}\n\nDocument text:\n${text}` }];
  } else if (mimeType === "application/pdf") {
    content = [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
      { type: "text", text: PROMPT },
    ];
  } else {
    const supportedMime = ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mimeType)
      ? mimeType
      : "image/jpeg";
    content = [
      { type: "image", source: { type: "base64", media_type: supportedMime, data: buffer.toString("base64") } },
      { type: "text", text: PROMPT },
    ];
  }

  const response = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    messages: [{ role: "user", content }],
  });
  const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
  return normalizeClientInvoiceExtraction(parseJson(text));
}

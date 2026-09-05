import Anthropic from "@anthropic-ai/sdk";
import { preprocessImage } from "./image-preprocessor";
import { normalizeExpenseCategory } from "./utils";

const anthropic = new Anthropic();

export type OcrDocumentKind = "supplier_invoice" | "expense_note";

// ── Amount / date parsers ─────────────────────────────────────────────────────

function parseAmount(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[^\d.,]/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const normalized =
    lastComma > lastDot
      ? s.replace(/\./g, "").replace(",", ".")   // "1.500,00" → "1500.00"
      : s.replace(/,/g, "");                      // "1,500.00" → "1500.00"
  const n = parseFloat(normalized);
  return isNaN(n) ? null : n;
}

function parseDate(v: unknown): string | null {
  if (!v || typeof v !== "string") return null;
  const dmy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

function addDays(date: string | null, days: number): string | null {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

const MOROCCAN_TVA_RATES = [7, 10, 14, 20] as const;

function normalizeTvaRate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : parseFloat(String(value).replace("%", "").replace(",", "."));
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  return MOROCCAN_TVA_RATES.includes(rounded as any) ? rounded : null;
}

function inferTvaRate(amountTtc: number | null, tvaAmount: number | null, amountHt: number | null): number | null {
  if (tvaAmount == null || tvaAmount <= 0) return null;

  const fromHt = amountHt != null && amountHt > 0
    ? (tvaAmount / amountHt) * 100
    : null;
  const fromTtc = amountTtc != null && amountTtc > tvaAmount
    ? (tvaAmount / (amountTtc - tvaAmount)) * 100
    : null;

  const candidates = [fromHt, fromTtc].filter((rate): rate is number => rate != null && Number.isFinite(rate));
  for (const candidate of candidates) {
    const match = MOROCCAN_TVA_RATES.find((rate) => Math.abs(candidate - rate) <= 1);
    if (match) return match;
  }
  return null;
}

function computeAmountHt(amountTtc: number | null, tvaAmount: number | null, tvaRate: number | null): number | null {
  if (amountTtc == null) return null;
  if (tvaAmount != null && tvaAmount > 0) return Math.max(0, amountTtc - tvaAmount);
  if (tvaRate != null && tvaRate > 0) return amountTtc / (1 + tvaRate / 100);
  return null;
}

function computeTvaAmount(amountTtc: number | null, amountHt: number | null, tvaRate: number | null): number | null {
  if (amountTtc != null && amountHt != null && amountTtc >= amountHt) return amountTtc - amountHt;
  if (amountTtc != null && tvaRate != null && tvaRate > 0) {
    return amountTtc - amountTtc / (1 + tvaRate / 100);
  }
  return null;
}

function cleanDescription(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value)
    .replace(/\s+/g, " ")
    .replace(/\b(qté|quantité|prix unitaire|pu ht|total ht|total ttc)\b/gi, "")
    .trim();
  if (!text) return null;
  return text.length > 140 ? `${text.slice(0, 137).trim()}…` : text;
}

function fallbackAccountingDescription(input: {
  category?: unknown;
  vendorName?: unknown;
  invoiceNumber?: unknown;
  date?: string | null;
  documentType?: unknown;
  documentKind?: OcrDocumentKind;
}) {
  const category = typeof input.category === "string" && input.category.trim()
    ? input.category.trim()
    : input.documentKind === "expense_note" ? "Autre dépense" : "Achat";
  const vendor = typeof input.vendorName === "string" && input.vendorName.trim() ? input.vendorName.trim() : null;
  const reference = typeof input.invoiceNumber === "string" && input.invoiceNumber.trim() ? input.invoiceNumber.trim() : null;
  const isAvoir = String(input.documentType ?? "").toLowerCase() === "avoir";

  const parts = [isAvoir
    ? `Avoir fournisseur — ${category}`
    : input.documentKind === "expense_note"
      ? `Note de frais — ${category.toLowerCase()}`
      : `Achat ${category.toLowerCase()}`];
  if (vendor) parts.push(vendor);
  if (reference) parts.push(`Facture ${reference}`);
  if (input.date) parts.push(input.date.slice(0, 7));
  return parts.join(" — ");
}

// ── Prompts ───────────────────────────────────────────────────────────────────

const MAIN_PROMPT = `You are an expert at reading Moroccan business invoices and receipts, including old, scanned, faded, or low-quality documents.

Analyze this document carefully. Even if the image quality is poor, try to extract as much information as possible.

Extract:
1. vendor_name: The company/person who issued this (look for header, logo area, top of document)
2. date: Invoice or receipt date in DD/MM/YYYY format. If unclear, look for any date on the document.
3. invoice_number: Any reference number (Facture N°, Réf, N°, #, etc.)
4. amount_ht: Total before tax (HT, hors taxe). If only TTC visible, estimate HT.
5. tva_rate: TVA percentage — only 7, 10, 14, or 20. Default to 20 if unclear.
6. tva_amount: TVA amount in MAD
7. amount_ttc: Final net amount payable after any remise/rabais/ristourne. This is usually the last "Total TTC" visible.
8. discount_amount: Total TTC discount explicitly shown as "Remise", "Rabais", "Ristourne" or "RRR". Return 0 when none is shown. Return the monetary amount, not the percentage.
9. description: A proper accounting description in French, not a raw copy of the line-item designation. It should summarize the accounting nature of the invoice for bookkeeping.
10. payment_method: Cash, Virement, Chèque, or Carte
11. category: Best guess from: Achats, Salaires, Loyer, Fournitures, Transport, Communication, Fiscalité, Autre dépense
12. document_type: Classify as "invoice", "receipt" (including ticket/reçu), "purchase_order" (bon de commande), "delivery_note" (bon de livraison), "avoir", "bank_statement", or "other". Use "avoir" for a credit note / avoir fournisseur (keywords: AVOIR, Note de crédit, Credit Note, Avoir N°, rectificatif).
13. due_date: Payment due date — look for: "Date d'échéance", "Payable avant", "À régler avant", "Due date", "Net 30/60", "Échéance", "Paiement à X jours" (add X days to invoice date). Format: DD/MM/YYYY. If no due date/payment term is found, default to invoice date + 60 days.
14. is_supplier_invoice: true if this document was issued BY a supplier TO you (you are the buyer/recipient — check the "À:" section). true for receipts/tickets. false if your company is in the "De:" section (it's your own invoice). Default: true.
15. supplier_ice and supplier_if: Moroccan supplier tax identifiers when visible.
16. supplier_rib and supplier_iban: Supplier payment details when printed on the document. Never infer or invent them.

IMPORTANT RULES:
- If you can only read SOME fields, return what you can
- Never return null for amount_ttc — estimate if needed
- For amounts: remove spaces, convert commas to dots. Examples: "1 500,00" → 1500.00, "1.500,00" → 1500.00
- If date is ambiguous: prefer more recent dates
- Vendor name: use the ISSUER not the recipient
- If document is in Arabic, still extract the numbers
- TVA: actively look for labels such as "TVA", "Taux TVA", "Montant TVA", "Taxe", "VAT", "Total TVA", or tax columns in line-item tables.
- If HT and TTC are visible but TVA rate is not written, infer the rate from TTC - HT.
- If the TVA rate is not visible or cannot be inferred, return tva_rate = 20. Do not return null for tva_rate on invoices/receipts with an amount.
- Description: generate a clean French bookkeeping label. Do NOT just copy the "Désignation" text or product/service line details.
- Good description examples:
  - "Achat fournitures de bureau — Facture F2026-018"
  - "Prestation télécom internet — Facture INV-4421 — juillet 2026"
  - "Loyer professionnel — Quittance juillet 2026"
  - "Achat carburant et transport — Ticket caisse"
  - "Avoir fournisseur — correction facture F2026-018"
- Keep description short, useful for an accounting ledger, and under 140 characters.

Confidence scoring:
- high: You can clearly read the value
- medium: You can partially read or infer the value
- low: You are guessing based on context

Return ONLY this JSON, nothing else:
{
  "vendor_name": {"value": "...", "confidence": "high|medium|low"},
  "date": {"value": "DD/MM/YYYY", "confidence": "high|medium|low"},
  "invoice_number": {"value": "...", "confidence": "high|medium|low"},
  "amount_ht": {"value": 0.00, "confidence": "high|medium|low"},
  "tva_rate": {"value": 20, "confidence": "high|medium|low"},
  "tva_amount": {"value": 0.00, "confidence": "high|medium|low"},
  "amount_ttc": {"value": 0.00, "confidence": "high|medium|low"},
  "discount_amount": {"value": 0.00, "confidence": "high|medium|low"},
  "description": {"value": "...", "confidence": "high|medium|low"},
  "payment_method": {"value": "...", "confidence": "high|medium|low"},
  "category": {"value": "...", "confidence": "high|medium|low"},
  "due_date": {"value": "DD/MM/YYYY or null", "confidence": "high|medium|low"},
  "is_supplier_invoice": {"value": true, "confidence": "high|medium|low"},
  "supplier_ice": {"value": "... or null", "confidence": "high|medium|low"},
  "supplier_if": {"value": "... or null", "confidence": "high|medium|low"},
  "supplier_rib": {"value": "... or null", "confidence": "high|medium|low"},
  "supplier_iban": {"value": "... or null", "confidence": "high|medium|low"},
  "document_type": "invoice|receipt|purchase_order|delivery_note|avoir|bank_statement|other",
  "overall_confidence": "high|medium|low",
  "extraction_notes": "Any issues noticed with the document"
}`;

const TEXT_PROMPT = (text: string) =>
  `You are an expert at reading Moroccan business invoices. The following text was extracted from a PDF document:

<document_text>
${text}
</document_text>

Extract the invoice/receipt data from this text. Follow the same rules as for visual extraction.
For TVA, search for labels like "TVA", "Taux TVA", "Montant TVA", "Taxe", "VAT", "Total TVA". If HT and TTC are visible, infer the rate. If no rate is visible or inferable, default tva_rate to 20.
For discount_amount, search for "Remise", "Rabais", "Ristourne" or "RRR" and return its TTC monetary amount, not its percentage. amount_ttc must be the final net payable after this discount.
For due_date, search for "Échéance", "Date d'échéance", "Payable avant", "Net 30/60", "Paiement à X jours". If missing, default to invoice date + 60 days.
For description, generate a clean French bookkeeping label. Do not copy the raw "Désignation" line. Examples: "Achat fournitures de bureau — Facture F2026-018", "Prestation télécom internet — juillet 2026", "Loyer professionnel — Quittance juillet 2026".
Extract the supplier ICE, IF, RIB and IBAN when explicitly present. Never infer banking details.

Return ONLY this JSON, nothing else:
{
  "vendor_name": {"value": "...", "confidence": "high|medium|low"},
  "date": {"value": "DD/MM/YYYY", "confidence": "high|medium|low"},
  "invoice_number": {"value": "...", "confidence": "high|medium|low"},
  "amount_ht": {"value": 0.00, "confidence": "high|medium|low"},
  "tva_rate": {"value": 20, "confidence": "high|medium|low"},
  "tva_amount": {"value": 0.00, "confidence": "high|medium|low"},
  "amount_ttc": {"value": 0.00, "confidence": "high|medium|low"},
  "discount_amount": {"value": 0.00, "confidence": "high|medium|low"},
  "description": {"value": "...", "confidence": "high|medium|low"},
  "payment_method": {"value": "...", "confidence": "high|medium|low"},
  "category": {"value": "Achats|Salaires|Loyer|Fournitures|Transport|Communication|Fiscalité|Autre dépense", "confidence": "high|medium|low"},
  "due_date": {"value": "DD/MM/YYYY or null", "confidence": "high|medium|low"},
  "is_supplier_invoice": {"value": true, "confidence": "high|medium|low"},
  "supplier_ice": {"value": "... or null", "confidence": "high|medium|low"},
  "supplier_if": {"value": "... or null", "confidence": "high|medium|low"},
  "supplier_rib": {"value": "... or null", "confidence": "high|medium|low"},
  "supplier_iban": {"value": "... or null", "confidence": "high|medium|low"},
  "document_type": "invoice|receipt|purchase_order|delivery_note|avoir|bank_statement|other",
  "overall_confidence": "high|medium|low",
  "extraction_notes": "..."
}`;

const EXPENSE_NOTE_PROMPT = `You are an expert at reading Moroccan expense notes and their supporting documents: till receipts, restaurant receipts, fuel tickets, transport tickets, hotel receipts, and other employee-paid business expenses.

Extract the merchant name, expense date, receipt/ticket reference, final amount paid, payment method, expense category, and a short French bookkeeping description. Extract HT, TVA rate, and TVA amount only when they are explicitly printed or can be calculated reliably from printed HT and TTC amounts. Never assume a 20% TVA rate for an expense note. There is no payment due date for an expense that was already paid.

category must be exactly one of these labels: Achats, Salaires, Loyer, Fournitures, Transport, Déplacements et missions, Communication, Fiscalité, Autre dépense. Never return a custom category.
Classification rules:
- fuel, taxi, train, plane, tolls, parking, meals, restaurants, hotels, accommodation, missions, or vehicle rental -> Déplacements et missions
- freight, delivery, or business transport services -> Transport
- office supplies, stationery, small office or IT equipment -> Fournitures
- phone, mobile, internet, or telecom -> Communication
- professional premises rent -> Loyer
- taxes, duties, stamps, or government fees -> Fiscalité
- payroll or personnel remuneration -> Salaires
- goods, merchandise, inventory, or raw materials bought for resale/production -> Achats
- anything not covered above -> Autre dépense; this category requires manual account review
Classify normal expense proofs as "receipt". Set is_supplier_invoice to false. Do not invent supplier tax or bank identifiers.

Return ONLY this JSON, nothing else:
{
  "vendor_name": {"value": "...", "confidence": "high|medium|low"},
  "date": {"value": "DD/MM/YYYY", "confidence": "high|medium|low"},
  "invoice_number": {"value": "...", "confidence": "high|medium|low"},
  "amount_ht": {"value": 0.00, "confidence": "high|medium|low"},
  "tva_rate": {"value": "7|10|14|20 or null", "confidence": "high|medium|low"},
  "tva_amount": {"value": "0.00 or null", "confidence": "high|medium|low"},
  "amount_ttc": {"value": 0.00, "confidence": "high|medium|low"},
  "discount_amount": {"value": 0.00, "confidence": "high|medium|low"},
  "description": {"value": "...", "confidence": "high|medium|low"},
  "payment_method": {"value": "Cash|Virement|Chèque|Carte or null", "confidence": "high|medium|low"},
  "category": {"value": "Achats|Salaires|Loyer|Fournitures|Transport|Déplacements et missions|Communication|Fiscalité|Autre dépense", "confidence": "high|medium|low"},
  "due_date": {"value": null, "confidence": "high|medium|low"},
  "is_supplier_invoice": {"value": false, "confidence": "high"},
  "supplier_ice": {"value": null, "confidence": "high"},
  "supplier_if": {"value": null, "confidence": "high"},
  "supplier_rib": {"value": null, "confidence": "high"},
  "supplier_iban": {"value": null, "confidence": "high"},
  "document_type": "receipt|other",
  "overall_confidence": "high|medium|low",
  "extraction_notes": "..."
}`;

const EXPENSE_TEXT_PROMPT = (text: string) => `${EXPENSE_NOTE_PROMPT}

The following text was extracted from the expense document:
<document_text>
${text}
</document_text>`;

const RETRY_PROMPT = `This is a difficult document. Focus ONLY on finding monetary amounts.

Look for:
- Any number followed by "MAD", "DH", "Dhs", "درهم"
- Numbers in a total/sum row at the bottom
- The largest monetary amount on the document
- Any amount after "Total", "Montant", "Net à payer", "TTC"

Return ONLY:
{
  "largest_amount": 0.00,
  "all_amounts_found": [],
  "likely_total": 0.00
}`;

// ── Normalize response to flat OcrData ────────────────────────────────────────

export function normalizeMainResponse(raw: any, documentKind: OcrDocumentKind = "supplier_invoice"): Record<string, unknown> {
  function val(f: any) { return (typeof f === "object" && f !== null) ? f.value : f; }
  function conf(f: any): string | undefined { return (typeof f === "object" && f !== null) ? f.confidence : undefined; }

  const fieldConf: Record<string, string> = {};
  for (const k of ["vendor_name", "date", "amount_ttc", "discount_amount", "tva_rate", "tva_amount", "amount_ht", "description", "category", "payment_method", "invoice_number", "due_date", "is_supplier_invoice", "supplier_ice", "supplier_if", "supplier_rib", "supplier_iban"]) {
    const c = conf(raw[k]);
    if (c) fieldConf[k] = c;
  }

  const vendorName = val(raw.vendor_name) ?? null;
  const amountTtc = parseAmount(val(raw.amount_ttc));
  const discountAmount = parseAmount(val(raw.discount_amount)) ?? 0;
  const grossTtc = amountTtc != null ? amountTtc + discountAmount : null;
  const rawTvaAmount = parseAmount(val(raw.tva_amount));
  const rawAmountHt = parseAmount(val(raw.amount_ht));
  const rawRate = val(raw.tva_rate);
  const tvaRate =
    normalizeTvaRate(rawRate)
    ?? inferTvaRate(grossTtc, rawTvaAmount, rawAmountHt)
    ?? (documentKind === "supplier_invoice" && amountTtc != null ? 20 : null);
  const amountHt = rawAmountHt ?? computeAmountHt(grossTtc, rawTvaAmount, tvaRate);
  const tvaAmount = rawTvaAmount ?? computeTvaAmount(grossTtc, amountHt, tvaRate);
  const invoiceDate = parseDate(val(raw.date));
  const parsedDueDate = parseDate(val(raw.due_date));
  const dueDate = documentKind === "expense_note" ? null : parsedDueDate ?? addDays(invoiceDate, 60);
  const dueDateConfidence = conf(raw.due_date) ?? (dueDate ? "low" : null);
  const invoiceNumber = val(raw.invoice_number);
  const category = normalizeExpenseCategory(val(raw.category));
  const description = cleanDescription(val(raw.description)) ?? fallbackAccountingDescription({
    category,
    vendorName,
    invoiceNumber,
    date: invoiceDate,
    documentType: raw.document_type,
    documentKind,
  });
  const overall = raw.overall_confidence ?? "medium";

  return {
    vendor_name: vendorName,
    vendor:      vendorName,
    date:        invoiceDate,
    amount:      amountTtc != null ? -amountTtc : null,
    amount_ttc:  amountTtc,
    discount_amount: discountAmount,
    tva_rate:    tvaRate,
    tva_amount:  tvaAmount,
    amount_ht:   amountHt,
    description,
    category,
    payment_method: val(raw.payment_method) ?? null,
    receipt_number: invoiceNumber ?? null,
    due_date:       dueDate,
    due_date_confidence: dueDateConfidence,
    is_supplier_invoice: documentKind === "expense_note" ? false : val(raw.is_supplier_invoice) ?? true,
    supplier_ice: val(raw.supplier_ice) ?? null,
    supplier_if: val(raw.supplier_if) ?? null,
    supplier_rib: val(raw.supplier_rib) ?? null,
    supplier_iban: val(raw.supplier_iban) ?? null,
    document_type:  raw.document_type ?? null,
    overall_confidence: overall,
    confidence: overall === "high" ? 0.9 : overall === "medium" ? 0.6 : 0.3,
    _field_confidence: fieldConf,
    extraction_notes: raw.extraction_notes ?? null,
  };
}

function parseJSON(text: string): any {
  const cleaned = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  return JSON.parse(cleaned);
}

// ── PDF text extraction ───────────────────────────────────────────────────────

async function extractPDFText(buffer: Buffer): Promise<string> {
  try {
    // Dynamic import to avoid SSR issues
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs" as any) as any;
    // Disable worker for Node.js server environment
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "";
    }
    const getDocument = pdfjsLib.getDocument ?? pdfjsLib.default?.getDocument;
    if (!getDocument) return "";

    const pdf = await getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: false,
    }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((item: any) => item.str).join(" ") + "\n";
    }
    return text.trim();
  } catch {
    return "";
  }
}

// ── Claude vision call ────────────────────────────────────────────────────────

async function callClaudeVision(
  buffer: Buffer,
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf",
  model: string,
  prompt: string,
): Promise<string> {
  const fileBlock =
    mimeType === "application/pdf"
      ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: buffer.toString("base64") } }
      : { type: "image" as const, source: { type: "base64" as const, media_type: mimeType, data: buffer.toString("base64") } };

  const msg = await anthropic.messages.create({
    model,
    max_tokens: 800,
    messages: [{ role: "user", content: [fileBlock, { type: "text" as const, text: prompt }] }],
  });
  return msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
}

async function callClaudeText(text: string, model: string, prompt: (text: string) => string): Promise<string> {
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 800,
    messages: [{ role: "user", content: prompt(text) }],
  });
  return msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
}

// ── Main extraction with fallback chain ───────────────────────────────────────

export async function extractWithFallback(
  buffer: Buffer,
  mimeType: string,
  documentKind: OcrDocumentKind = "supplier_invoice",
): Promise<Record<string, unknown>> {
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");
  const mainPrompt = documentKind === "expense_note" ? EXPENSE_NOTE_PROMPT : MAIN_PROMPT;
  const textPrompt = documentKind === "expense_note" ? EXPENSE_TEXT_PROMPT : TEXT_PROMPT;

  // ── Step 1: PDF embedded text (free, instant, perfect for digital PDFs) ──
  if (isPdf) {
    try {
      const text = await extractPDFText(buffer);
      if (text.length > 100) {
        const raw = parseJSON(await callClaudeText(text, "claude-haiku-4-5-20251001", textPrompt));
        const result = normalizeMainResponse(raw, documentKind);
        if (result.overall_confidence !== "low" && result.amount != null) {
          return result;
        }
        // Low confidence even with embedded text → fall through to vision
      }
    } catch {
      // fall through
    }
  }

  // ── Step 2: Preprocess image then try Haiku ───────────────────────────────
  let processedBuffer = buffer;
  let processedMime: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf" =
    mimeType as any;

  if (isImage) {
    try {
      processedBuffer = await preprocessImage(buffer);
      processedMime = "image/png";
    } catch {
      // use original if sharp fails
    }
  }

  try {
    const raw = parseJSON(
      await callClaudeVision(processedBuffer, processedMime, "claude-haiku-4-5-20251001", mainPrompt)
    );
    const result = normalizeMainResponse(raw, documentKind);

    // ── Step 3: Retry with number-focused prompt if low confidence ────────
    if ((result.overall_confidence === "low" || !result.amount) && isImage) {
      try {
        const retryRaw = parseJSON(
          await callClaudeVision(processedBuffer, processedMime, "claude-haiku-4-5-20251001", RETRY_PROMPT)
        );
        const fallbackAmount = parseAmount(retryRaw.likely_total ?? retryRaw.largest_amount);
        if (fallbackAmount && !result.amount) {
          result.amount = -fallbackAmount;
          result.overall_confidence = "medium";
          result.confidence = 0.5;
        }
      } catch { /* ignore */ }
    }

    if (result.overall_confidence !== "low" || result.amount != null) {
      return result;
    }

    // ── Step 4: Escalate to Sonnet ────────────────────────────────────────
    const sonnetRaw = parseJSON(
      await callClaudeVision(processedBuffer, processedMime, "claude-sonnet-4-6", mainPrompt)
    );
    return normalizeMainResponse(sonnetRaw, documentKind);
  } catch {
    return {};
  }
}

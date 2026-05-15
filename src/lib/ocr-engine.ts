import Anthropic from "@anthropic-ai/sdk";
import { preprocessImage } from "./image-preprocessor";

const anthropic = new Anthropic();

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
7. amount_ttc: Total including tax (TTC, toutes taxes). This is usually the most visible amount.
8. description: What was purchased or service provided
9. payment_method: Cash, Virement, Chèque, or Carte
10. category: Best guess from: Achats, Salaires, Loyer, Fournitures, Transport, Communication, Fiscalité, Autre dépense
11. document_type: Use "avoir" if the document is a credit note / avoir fournisseur (keywords: AVOIR, Note de crédit, Credit Note, Avoir N°, rectificatif)

IMPORTANT RULES:
- If you can only read SOME fields, return what you can
- Never return null for amount_ttc — estimate if needed
- For amounts: remove spaces, convert commas to dots. Examples: "1 500,00" → 1500.00, "1.500,00" → 1500.00
- If date is ambiguous: prefer more recent dates
- Vendor name: use the ISSUER not the recipient
- If document is in Arabic, still extract the numbers

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
  "description": {"value": "...", "confidence": "high|medium|low"},
  "payment_method": {"value": "...", "confidence": "high|medium|low"},
  "category": {"value": "...", "confidence": "high|medium|low"},
  "document_type": "invoice|receipt|avoir|bank_statement|other",
  "overall_confidence": "high|medium|low",
  "extraction_notes": "Any issues noticed with the document"
}`;

const TEXT_PROMPT = (text: string) =>
  `You are an expert at reading Moroccan business invoices. The following text was extracted from a PDF document:

<document_text>
${text}
</document_text>

Extract the invoice/receipt data from this text. Follow the same rules as for visual extraction.

Return ONLY this JSON, nothing else:
{
  "vendor_name": {"value": "...", "confidence": "high|medium|low"},
  "date": {"value": "DD/MM/YYYY", "confidence": "high|medium|low"},
  "invoice_number": {"value": "...", "confidence": "high|medium|low"},
  "amount_ht": {"value": 0.00, "confidence": "high|medium|low"},
  "tva_rate": {"value": 20, "confidence": "high|medium|low"},
  "tva_amount": {"value": 0.00, "confidence": "high|medium|low"},
  "amount_ttc": {"value": 0.00, "confidence": "high|medium|low"},
  "description": {"value": "...", "confidence": "high|medium|low"},
  "payment_method": {"value": "...", "confidence": "high|medium|low"},
  "category": {"value": "Achats|Salaires|Loyer|Fournitures|Transport|Communication|Fiscalité|Autre dépense", "confidence": "high|medium|low"},
  "document_type": "invoice|receipt|avoir|bank_statement|other",
  "overall_confidence": "high|medium|low",
  "extraction_notes": "..."
}`;

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

function normalizeMainResponse(raw: any): Record<string, unknown> {
  function val(f: any) { return (typeof f === "object" && f !== null) ? f.value : f; }
  function conf(f: any): string | undefined { return (typeof f === "object" && f !== null) ? f.confidence : undefined; }

  const fieldConf: Record<string, string> = {};
  for (const k of ["vendor_name", "date", "amount_ttc", "tva_rate", "tva_amount", "amount_ht", "description", "category", "payment_method", "invoice_number"]) {
    const c = conf(raw[k]);
    if (c) fieldConf[k] = c;
  }

  const vendorName = val(raw.vendor_name) ?? null;
  const amountTtc = parseAmount(val(raw.amount_ttc));
  const tvaAmount = parseAmount(val(raw.tva_amount));
  const amountHt  = parseAmount(val(raw.amount_ht)) ??
    (amountTtc != null && tvaAmount != null ? amountTtc - tvaAmount : null);
  const rawRate = val(raw.tva_rate);
  const tvaRate = rawRate != null ? (typeof rawRate === "number" ? rawRate : parseFloat(String(rawRate)) || null) : null;
  const overall = raw.overall_confidence ?? "medium";

  return {
    vendor_name: vendorName,
    vendor:      vendorName,
    date:        parseDate(val(raw.date)),
    amount:      amountTtc != null ? -amountTtc : null,
    tva_rate:    tvaRate,
    tva_amount:  tvaAmount,
    amount_ht:   amountHt,
    description: val(raw.description) ?? null,
    category:    val(raw.category)    ?? null,
    payment_method: val(raw.payment_method) ?? null,
    receipt_number: val(raw.invoice_number) ?? null,
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

    const pdf = await getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;
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

async function callClaudeText(text: string, model: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model,
    max_tokens: 800,
    messages: [{ role: "user", content: TEXT_PROMPT(text) }],
  });
  return msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
}

// ── Main extraction with fallback chain ───────────────────────────────────────

export async function extractWithFallback(
  buffer: Buffer,
  mimeType: string,
): Promise<Record<string, unknown>> {
  const isPdf = mimeType === "application/pdf";
  const isImage = mimeType.startsWith("image/");

  // ── Step 1: PDF embedded text (free, instant, perfect for digital PDFs) ──
  if (isPdf) {
    try {
      const text = await extractPDFText(buffer);
      if (text.length > 100) {
        const raw = parseJSON(await callClaudeText(text, "claude-haiku-4-5-20251001"));
        const result = normalizeMainResponse(raw);
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
      await callClaudeVision(processedBuffer, processedMime, "claude-haiku-4-5-20251001", MAIN_PROMPT)
    );
    const result = normalizeMainResponse(raw);

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
      await callClaudeVision(processedBuffer, processedMime, "claude-sonnet-4-6", MAIN_PROMPT)
    );
    return normalizeMainResponse(sonnetRaw);
  } catch {
    return {};
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import * as XLSX from "xlsx";
import { getMonthlyUsage, incrementUploadCount } from "@/lib/usage";
import { checkRateLimit, getClientIp, tooManyRequests } from "@/lib/rate-limit";
import { authorizePermission } from "@/lib/api-permissions";
import { requirePlanFeature } from "@/lib/api-plan";
import { BANK_STATEMENT_PDF_MAX_PAGES, countBankStatementPdfPages } from "@/lib/bank-import-limits";
import {
  BANK_STATEMENT_PDF_CHUNK_PAGES,
  BANK_STATEMENT_PDF_CONCURRENCY,
  addTokenUsage,
  estimateSonnet46CostUsd,
  mapWithConcurrency,
  splitBankStatementPdf,
  type BankStatementPdfChunk,
  type BankStatementTokenUsage,
} from "@/lib/bank-statement-chunks";
import {
  BANK_EXPENSE_CATEGORIES,
  BANK_INCOME_CATEGORIES,
  resolveBankTransactionCategory,
} from "@/lib/bank-transaction-category";

const IMPORT_LIMIT = 20;
const IMPORT_OPTS = { maxAttempts: IMPORT_LIMIT, windowMs: 5 * 60_000, blockMs: 10 * 60_000 };

export const maxDuration = 300;

const anthropic = new Anthropic();

function normalizeDate(d: string | null | undefined): string {
  if (!d) return new Date().toISOString().split("T")[0];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(d)) {
    const [dd, mm, yyyy] = d.split("/");
    return `${yyyy}-${mm}-${dd}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const parsed = new Date(d);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return new Date().toISOString().split("T")[0];
}

function normalizeAmount(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  // "1 500,00" → 1500.00  |  "1.500,00" → 1500.00  |  "1500.00" → 1500.00
  const s = String(v)
    .replace(/\s/g, "")          // remove spaces
    .replace(/\.(?=\d{3})/g, "") // remove thousands dots (1.500 → 1500)
    .replace(",", ".");          // comma decimal → dot
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// Robustly extract the first valid JSON object or array from any text
function extractJSON(raw: string): any {
  // 1. Strip outer markdown fences
  const stripped = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try { return JSON.parse(stripped); } catch {}

  // 2. Find first { or [ and try parsing from there
  const objIdx = raw.indexOf("{");
  const arrIdx = raw.indexOf("[");
  const starts: number[] = [];
  if (objIdx !== -1) starts.push(objIdx);
  if (arrIdx !== -1) starts.push(arrIdx);
  starts.sort((a, b) => a - b);

  for (const idx of starts) {
    const slice = raw.slice(idx);
    try { return JSON.parse(slice); } catch {}
    // Try to find matching closing bracket by scanning
    const opener = raw[idx];
    const closer = opener === "{" ? "}" : "]";
    let depth = 0, inStr = false, escape = false;
    for (let i = 0; i < slice.length; i++) {
      const c = slice[i];
      if (escape) { escape = false; continue; }
      if (c === "\\" && inStr) { escape = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === opener) depth++;
      else if (c === closer) { depth--; if (depth === 0) { try { return JSON.parse(slice.slice(0, i + 1)); } catch {} break; } }
    }
  }

  throw new Error(`JSON_PARSE_FAILED: ${raw.slice(0, 200)}`);
}

const EXTRACTION_PROMPT = `You are an expert at reading Moroccan bank statements (Attijariwafa, CIH, BMCE/Bank of Africa, BCP/Banque Populaire, Société Générale Maroc, BMCI, Al Barid Bank).

These statements typically have:
- Arabic and French text mixed together
- Dates in DD/MM/YYYY format
- Amounts with comma as decimal separator and spaces as thousands separator (e.g. 1 500,00)
- Separate Débit and Crédit columns (sometimes labeled Débit/Crédit, Sortie/Entrée, or similar)
- A running Solde/Balance column
- Transaction references or operation codes

Extract EVERY transaction row visible in this document. Look carefully at every line in the table — do not skip any row that has a date and amount.

Return ONLY a valid JSON object with this structure (no markdown, no explanation):
{
  "period": "Month Year in French e.g. Avril 2025",
  "transactions": [
    {
      "date": "DD/MM/YYYY",
      "description": "exact description text as shown",
      "reference": "reference/operation code if visible, or null",
      "debit": 1500.00,
      "credit": null,
      "balance": 45000.00,
      "category": "one allowed category"
    }
  ]
}

Rules:
- debit = money OUT (positive number, e.g. 1500.00) — leave null if not a debit
- credit = money IN (positive number, e.g. 5000.00) — leave null if not a credit
- Convert "1 500,00" → 1500.00 (remove spaces, replace comma with dot)
- Convert "1.500,00" → 1500.00 (European thousands dot + comma decimal)
- Include EVERY row with a date and amount — do not omit any
- Copy description text exactly as shown, including Arabic if present
- Categorize every transaction from its description and operation context.
- For credits, category MUST be exactly one of: ${BANK_INCOME_CATEGORIES.join(", ")}.
- For debits, category MUST be exactly one of: ${BANK_EXPENSE_CATEGORIES.join(", ")}.
- Prefer a specific category whenever the description supports it. Use "Autre revenu" or "Autre dépense" only when no specific category is reasonably supported.
- Examples: bank fees/commissions/agios → Banque; DGI/TVA/taxes/CNSS → Fiscalité; salaries/payroll → Salaires; fuel/tolls/ONCF/taxi → Transport; Maroc Telecom/Orange/Inwi/internet → Communication; rent/lease → Loyer; supplier purchases/stock → Achats; office supplies → Fournitures; customer settlements/sales receipts → Ventes; consulting/services/honoraires → Services; refunds → Remboursement.
- Return ONLY the JSON object — nothing else`;

class ExtractionResponseError extends Error {
  constructor(message: string, readonly usage: BankStatementTokenUsage) {
    super(message);
  }
}

class TruncatedExtractionError extends ExtractionResponseError {
  constructor(usage: BankStatementTokenUsage) {
    super("TRUNCATED", usage);
  }
}

async function callClaude(
  messages: Anthropic.MessageParam[],
  bank?: string,
  context?: { startPage: number; endPage: number; attempt?: number },
): Promise<{ period: string | null; transactions: any[]; usage: BankStatementTokenUsage }> {
  // Inject bank name hint if provided
  const prompt = bank
    ? EXTRACTION_PROMPT.replace("Moroccan bank statements", `Moroccan bank statements — this one is from ${bank}`)
    : EXTRACTION_PROMPT;

  // For text-only messages (CSV), replace the prompt inline
  const finalMessages: Anthropic.MessageParam[] = messages.map((m) => {
    if (typeof m.content === "string") {
      return { ...m, content: m.content.replace(EXTRACTION_PROMPT, prompt) };
    }
    if (Array.isArray(m.content)) {
      return {
        ...m,
        content: m.content.map((block: any) =>
          block.type === "text" ? { ...block, text: block.text === EXTRACTION_PROMPT ? prompt : block.text } : block
        ) as Anthropic.ContentBlockParam[],
      };
    }
    return m;
  });

  // Sonnet for document/image blocks; Haiku for plain text (CSV/Excel)
  const isTextOnly = finalMessages.every((m) => typeof m.content === "string");
  const requestedMaxTokens = isTextOnly ? 8192 : 16000;
  const startedAt = Date.now();
  const stream = anthropic.messages.stream({
    model: isTextOnly ? "claude-haiku-4-5-20251001" : "claude-sonnet-4-6",
    max_tokens: requestedMaxTokens,
    messages: finalMessages,
  });
  const response = await stream.finalMessage();

  console.info("[bank-statement] extraction completed", {
    pages: context ? `${context.startPage}-${context.endPage}` : undefined,
    attempt: context?.attempt ?? 1,
    requestedMaxTokens,
    stopReason: response.stop_reason,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    durationMs: Date.now() - startedAt,
  });

  const rawText = response.content[0].type === "text" ? response.content[0].text.trim() : "";
  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
  if (response.stop_reason === "max_tokens") {
    throw new TruncatedExtractionError(usage);
  }
  let parsed: any;
  try {
    parsed = extractJSON(rawText);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ExtractionResponseError(message, usage);
  }

  // Accept both { transactions: [] } and bare []
  const rawTxs: any[] = Array.isArray(parsed) ? parsed : (parsed.transactions ?? []);
  const period: string | null = parsed.period ?? null;

  return { period, transactions: rawTxs, usage };
}

async function pdfMessages(bytes: Uint8Array): Promise<Anthropic.MessageParam[]> {
  return [{
    role: "user",
    content: [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: Buffer.from(bytes).toString("base64"),
        },
      } as any,
      { type: "text" as const, text: EXTRACTION_PROMPT },
    ] as Anthropic.ContentBlockParam[],
  }];
}

async function extractPdfChunk(
  chunk: BankStatementPdfChunk,
  bank?: string,
): Promise<{ period: string | null; transactions: any[]; calls: number; usage: BankStatementTokenUsage }> {
  try {
    let lastError: unknown;
    let failedUsage: BankStatementTokenUsage = { inputTokens: 0, outputTokens: 0 };
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await callClaude(await pdfMessages(chunk.bytes), bank, {
          startPage: chunk.startPage,
          endPage: chunk.endPage,
          attempt,
        });
        return { ...result, calls: attempt, usage: addTokenUsage(failedUsage, result.usage) };
      } catch (error) {
        if (error instanceof TruncatedExtractionError) throw error;
        if (error instanceof ExtractionResponseError) {
          failedUsage = addTokenUsage(failedUsage, error.usage);
        }
        lastError = error;
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1_000));
      }
    }
    throw lastError;
  } catch (error) {
    if (!(error instanceof TruncatedExtractionError)) throw error;

    const pageCount = chunk.endPage - chunk.startPage + 1;
    if (pageCount === 1) {
      throw new Error(`PAGE_TRUNCATED:${chunk.startPage}`);
    }

    const smallerChunks = await splitBankStatementPdf(
      chunk.bytes,
      Math.ceil(pageCount / 2),
      chunk.startPage - 1,
    );
    console.warn("[bank-statement] splitting truncated PDF chunk", {
      pages: `${chunk.startPage}-${chunk.endPage}`,
      nextChunks: smallerChunks.map(item => `${item.startPage}-${item.endPage}`),
    });

    const results = [];
    for (const smallerChunk of smallerChunks) {
      results.push(await extractPdfChunk(smallerChunk, bank));
    }
    return {
      period: results.find(result => result.period)?.period ?? null,
      transactions: results.flatMap(result => result.transactions),
      calls: 1 + results.reduce((total, result) => total + result.calls, 0),
      usage: addTokenUsage(error.usage, ...results.map(result => result.usage)),
    };
  }
}

async function extractPdfInChunks(bytes: Uint8Array, bank?: string) {
  const chunks = await splitBankStatementPdf(bytes, BANK_STATEMENT_PDF_CHUNK_PAGES);
  const results = await mapWithConcurrency(
    chunks,
    BANK_STATEMENT_PDF_CONCURRENCY,
    chunk => extractPdfChunk(chunk, bank),
  );
  return {
    period: results.find(result => result.period)?.period ?? null,
    transactions: results.flatMap(result => result.transactions),
    initialChunkCount: chunks.length,
    aiCallCount: results.reduce((total, result) => total + result.calls, 0),
    usage: addTokenUsage(...results.map(result => result.usage)),
  };
}

function normalizeTxs(rawTxs: any[]): any[] {
  return rawTxs
    .map((t) => {
      const debit = normalizeAmount(t.debit);
      const credit = normalizeAmount(t.credit);
      // Prefer explicit debit/credit fields; fall back to legacy `amount` field
      let amount: number;
      if (debit !== null && credit === null) {
        amount = -debit;
      } else if (credit !== null && debit === null) {
        amount = credit;
      } else if (debit !== null && credit !== null) {
        // Both present (shouldn't happen but handle gracefully)
        amount = credit - debit;
      } else {
        // Legacy fallback
        amount = normalizeAmount(t.amount) ?? 0;
      }

      const description = String(t.description ?? "").trim() || "Transaction";
      return {
        date: normalizeDate(t.date),
        description,
        amount,
        category: resolveBankTransactionCategory(t.category, amount, description),
        reference: t.reference ? String(t.reference).trim() : null,
      };
    })
    .filter((t) => t.amount !== 0); // drop zero-amount rows (header/footer artifacts)
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(getClientIp(req), "import/bank-statement", IMPORT_OPTS);
  if (!rl.allowed) return tooManyRequests(rl, IMPORT_LIMIT, "Trop de tentatives. Réessayez dans 10 minutes.");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const permission = await authorizePermission("accounting", "create");
  if (permission.response) return permission.response;
  const plan = await requirePlanFeature("bank_import");
  if (plan.response) return plan.response;

  const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).single();
  if (company) {
    const usage = await getMonthlyUsage(company.id);
    if (!usage.allowed) {
      return NextResponse.json({
        error: "limit_reached",
        message: `Limite mensuelle atteinte (${usage.used}/${usage.limit} documents). Réinitialisation le ${usage.resetDate}.`,
        used: usage.used,
        limit: usage.limit,
        resetDate: usage.resetDate,
      }, { status: 429 });
    }
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const bank = (formData.get("bank") as string | null) ?? undefined;

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "Fichier trop volumineux. Maximum 10MB." }, { status: 400 });
  }

  const isPDF = file.type === "application/pdf";
  const isImage = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(file.type);
  const isXLSX = file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    || file.name.toLowerCase().endsWith(".xlsx");
  const isXLS = file.type === "application/vnd.ms-excel" || file.name.toLowerCase().endsWith(".xls");
  const isCSV = file.type === "text/csv" || file.type === "application/csv"
    || file.name.toLowerCase().endsWith(".csv");

  if (!isPDF && !isImage && !isCSV && !isXLSX && !isXLS) {
    return NextResponse.json(
      { error: "Format non supporté. Utilisez PDF, CSV, Excel, JPG ou PNG." },
      { status: 400 }
    );
  }

  // PDFs are split before extraction so one large statement never depends on a
  // single, very large JSON response. A truncated chunk is split recursively.
  if (isPDF) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pages = countBankStatementPdfPages(bytes);
    if (pages > BANK_STATEMENT_PDF_MAX_PAGES) {
      return NextResponse.json(
        { error: `Ce relevé contient ${pages} pages. Maximum autorisé : ${BANK_STATEMENT_PDF_MAX_PAGES} pages par import.` },
        { status: 400 },
      );
    }

    try {
      const result = await extractPdfInChunks(bytes, bank);
      // Chunks never overlap, so retain identical-looking rows: two legitimate
      // bank operations can have the same date, amount, description, and reference.
      const transactions = normalizeTxs(result.transactions);
      if (transactions.length === 0) {
        return NextResponse.json(
          { error: "Aucune transaction valide détectée. Vérifiez que le document est bien un relevé bancaire ou importez manuellement." },
          { status: 422 },
        );
      }

      if (company) {
        await incrementUploadCount(company.id, user.id, {
          fileName: file.name,
          fileType: file.type,
          pageCount: pages,
          source: "bank_import",
        });
      }
      const estimatedCostUsd = estimateSonnet46CostUsd(result.usage);
      return NextResponse.json({
        transactions,
        period: result.period,
        count: transactions.length,
        processing: {
          pages,
          initial_chunks: result.initialChunkCount,
          ai_calls: result.aiCallCount,
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
          total_tokens: result.usage.inputTokens + result.usage.outputTokens,
          estimated_cost_usd: Number(estimatedCostUsd.toFixed(4)),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[bank-statement] PDF extraction failed", { pages, message });
      if (message.toLowerCase().includes("password") || message.toLowerCase().includes("encrypt")) {
        return NextResponse.json(
          { error: "Ce PDF est protégé par un mot de passe. Téléchargez une version sans protection depuis votre banque." },
          { status: 422 },
        );
      }
      if (message.startsWith("PAGE_TRUNCATED:")) {
        const page = message.split(":")[1];
        return NextResponse.json(
          { error: `La page ${page} contient trop de lignes pour être extraite complètement. Exportez le relevé en CSV ou importez cette page séparément.` },
          { status: 422 },
        );
      }
      return NextResponse.json(
        { error: `Erreur d'analyse du relevé (${message.slice(0, 100)}).` },
        { status: 422 },
      );
    }
  }

  // Build base messages for CSV, Excel, and images.
  let baseMessages: Anthropic.MessageParam[];

  if (isCSV || isXLSX || isXLS) {
    let csvText: string;
    if (isXLSX || isXLS) {
      const bytes = await file.arrayBuffer();
      const wb = XLSX.read(bytes);
      const ws = wb.Sheets[wb.SheetNames[0]];
      csvText = XLSX.utils.sheet_to_csv(ws);
    } else {
      csvText = await file.text();
    }
    baseMessages = [{
      role: "user",
      content: `${EXTRACTION_PROMPT}\n\nCSV content:\n\`\`\`\n${csvText}\n\`\`\``,
    }];
  } else {
    // Image — still needs vision
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = (file.type === "image/jpg" ? "image/jpeg" : file.type) as
      "image/jpeg" | "image/png" | "image/webp";
    baseMessages = [{
      role: "user",
      content: [
        { type: "image" as const, source: { type: "base64" as const, media_type: mimeType, data: base64 } },
        { type: "text" as const, text: EXTRACTION_PROMPT },
      ] as Anthropic.ContentBlockParam[],
    }];
  }

  // Retry up to 3 times if Claude returns 0 transactions
  const MAX_ATTEMPTS = 2;
  let lastError: string | null = null;
  let period: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await callClaude(baseMessages, bank);
      period = result.period;

      if (result.transactions.length === 0) {
        lastError = "Aucune transaction détectée.";
        if (attempt < MAX_ATTEMPTS) await sleep(1000);
        continue;
      }

      const transactions = normalizeTxs(result.transactions);

      if (transactions.length === 0) {
        lastError = "Aucune transaction valide détectée.";
        if (attempt < MAX_ATTEMPTS) await sleep(1000);
        continue;
      }

      if (company) {
        await incrementUploadCount(company.id, user.id, {
          fileName: file.name, fileType: file.type, source: "bank_import",
        });
      }
      return NextResponse.json({ transactions, period, count: transactions.length });

    } catch (err: any) {
      const msg = err?.message ?? String(err);
      console.error(`[bank-statement] attempt ${attempt}:`, msg);

      if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("encrypt")) {
        return NextResponse.json(
          { error: "Ce PDF est protégé par un mot de passe. Téléchargez une version sans protection depuis votre banque." },
          { status: 422 }
        );
      }

      lastError = msg === "TRUNCATED"
        ? "Relevé trop volumineux — la réponse a été tronquée."
        : msg.startsWith("JSON_PARSE_FAILED")
        ? "Format de réponse inattendu."
        : `Erreur d'analyse (${msg.slice(0, 80)})`;

      if (msg === "TRUNCATED") break;
      if (attempt < MAX_ATTEMPTS) await sleep(1000);
    }
  }

  return NextResponse.json(
    { error: `${lastError} Vérifiez que le document est bien un relevé bancaire ou importez manuellement.` },
    { status: 422 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120;

const anthropic = new Anthropic();

// ── Prompts (per user spec) ───────────────────────────────────────────────────

const TX_PROMPT = `You are a Moroccan bank statement parser.
Extract ALL transaction lines from this bank statement.

Return ONLY a JSON array, no other text:
[
  {
    "date": "DD/MM/YYYY",
    "description": "exact text from statement",
    "reference": "reference number if visible or null",
    "debit": 1500.00,
    "credit": null,
    "balance": 45000.00
  }
]

Rules:
- debit = money going OUT (positive number, no minus sign)
- credit = money coming IN (positive number)
- Keep original description text exactly as shown
- Include ALL lines, do not skip any
- Date format: DD/MM/YYYY
- Numbers: use decimal point (not comma)
- If balance column not visible: use null
- Return ONLY the JSON array`;

const HEADER_PROMPT = `Extract from this bank statement header.
Return JSON only:
{
  "bank_name": "bank name",
  "account_number": "account number or null",
  "period_start": "DD/MM/YYYY or null",
  "period_end": "DD/MM/YYYY or null",
  "opening_balance": 0.00,
  "closing_balance": 0.00
}`;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseIsoDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.substring(0, 10);
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString().split("T")[0];
}

function periodLabel(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const label = new Date(isoDate).toLocaleDateString("fr-MA", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").trim();
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if ((ch === "," || ch === ";") && !inQ) { result.push(cur); cur = ""; }
    else cur += ch;
  }
  result.push(cur);
  return result;
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = splitCSVLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (vals[i] ?? "").trim(); });
    return row;
  }).filter(row => Object.values(row).some(v => v !== ""));
}

function parseAmt(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\s/g, "").replace(",", ".")) || 0;
}

function mapCSVRow(row: Record<string, string>): { date: string | null; description: string; reference: string; amount: number; balance_after: number } {
  const k = Object.keys(row);
  const dateKey  = k.find(h => /^(date|dat|value.?date|date.?val)/.test(h)) ?? "";
  const descKey  = k.find(h => /^(libel|description|details|motif|nature|label)/.test(h)) ?? "";
  const refKey   = k.find(h => /^(ref|reference|num|numero|n°)/.test(h)) ?? "";
  const debitKey = k.find(h => /^(debit|sortie|retrait)/.test(h)) ?? "";
  const creditKey= k.find(h => /^(credit|cr[eé]dit|entree|versement)/.test(h)) ?? "";
  const amtKey   = k.find(h => /^(montant|amount|amt)/.test(h)) ?? "";
  const balKey   = k.find(h => /^(solde|balance|bal)/.test(h)) ?? "";

  let amount = 0;
  if (debitKey && row[debitKey]) amount = -Math.abs(parseAmt(row[debitKey]));
  else if (creditKey && row[creditKey]) amount = Math.abs(parseAmt(row[creditKey]));
  else if (amtKey) amount = parseAmt(row[amtKey]);

  const rawDate = row[dateKey] ?? "";
  // parse DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
  let date: string | null = null;
  const m1 = rawDate.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m1) {
    const y = m1[3].length === 2 ? "20" + m1[3] : m1[3];
    date = `${y}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  } else if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
    date = rawDate.substring(0, 10);
  }

  return {
    date,
    description: row[descKey] ?? "",
    reference: row[refKey] ?? "",
    amount,
    balance_after: balKey ? parseAmt(row[balKey]) : 0,
  };
}

// ── AI extraction ─────────────────────────────────────────────────────────────

interface DetectedLine {
  date: string;
  description: string;
  reference: string | null;
  amount: number;
  balance_after: number | null;
}

interface DetectResult {
  bank_name: string | null;
  account_number: string | null;
  period_start: string | null;
  period_end: string | null;
  period_label: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  lines: DetectedLine[];
  warnings: string[];
}

async function extractFromAI(base64: string, mimeType: string): Promise<DetectResult> {
  const isPDF = mimeType === "application/pdf";
  const warnings: string[] = [];

  type FileBlock =
    | { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } };

  const fileBlock: FileBlock = isPDF
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: (mimeType === "image/jpg" ? "image/jpeg" : mimeType) as "image/jpeg" | "image/png" | "image/webp", data: base64 } };

  // Call 1 — transactions
  const txMsg = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: [fileBlock as any, { type: "text", text: TX_PROMPT }] }],
  });

  let rawLines: any[] = [];
  const txText = txMsg.content[0].type === "text" ? txMsg.content[0].text : "[]";
  try {
    const parsed = JSON.parse(stripFences(txText));
    rawLines = Array.isArray(parsed) ? parsed : [];
  } catch {
    warnings.push("Format de réponse inattendu pour les transactions.");
  }

  // Call 2 — header
  const hdMsg = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: [fileBlock as any, { type: "text", text: HEADER_PROMPT }] }],
  });

  let rawHeader: any = {};
  const hdText = hdMsg.content[0].type === "text" ? hdMsg.content[0].text : "{}";
  try {
    rawHeader = JSON.parse(stripFences(hdText));
  } catch {
    rawHeader = {};
  }

  // Normalise lines
  let skipped = 0;
  const lines: DetectedLine[] = [];

  for (const row of rawLines) {
    const date = parseIsoDate(row.date);
    if (!date) { skipped++; continue; }

    const credit = typeof row.credit === "number" ? row.credit : null;
    const debit  = typeof row.debit  === "number" ? row.debit  : null;
    const amount = credit != null ? +credit : debit != null ? -Math.abs(debit) : 0;
    if (amount === 0) { skipped++; continue; }

    lines.push({
      date,
      description: String(row.description ?? "").trim() || "Transaction",
      reference: row.reference ? String(row.reference).trim() : null,
      amount,
      balance_after: typeof row.balance === "number" ? row.balance : null,
    });
  }

  if (skipped > 0) {
    warnings.push(`${skipped} ligne${skipped > 1 ? "s" : ""} n'ont pas pu être extraites. Vérifiez le tableau avant d'importer.`);
  }

  // Dedup across pages
  const seen = new Set<string>();
  const deduped = lines.filter(l => {
    const key = `${l.date}|${l.amount}|${l.description.slice(0, 30)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const periodStart = parseIsoDate(rawHeader.period_start);
  const periodEnd   = parseIsoDate(rawHeader.period_end);

  return {
    bank_name:       rawHeader.bank_name       ?? null,
    account_number:  rawHeader.account_number  ?? null,
    period_start:    periodStart,
    period_end:      periodEnd,
    period_label:    periodLabel(periodStart),
    opening_balance: typeof rawHeader.opening_balance === "number" ? rawHeader.opening_balance : null,
    closing_balance: typeof rawHeader.closing_balance === "number" ? rawHeader.closing_balance : null,
    lines: deduped,
    warnings,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });

    const MAX = 15 * 1024 * 1024;
    if (file.size > MAX) {
      return NextResponse.json({ error: "Fichier trop volumineux. Maximum 15 Mo." }, { status: 400 });
    }

    const mime = file.type;
    const name = file.name.toLowerCase();
    const isPDF   = mime === "application/pdf" || name.endsWith(".pdf");
    const isImage = ["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(mime) || /\.(jpg|jpeg|png|webp)$/.test(name);
    const isCSV   = mime === "text/csv" || mime === "text/plain" || name.endsWith(".csv");
    const isXLSX  = name.endsWith(".xlsx") || name.endsWith(".xls") ||
                    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                    mime === "application/vnd.ms-excel";

    // ── PDF / Image → Claude AI ───────────────────────────────────────────────
    if (isPDF || isImage) {
      const bytes = await file.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const detectedMime = isPDF ? "application/pdf" : (mime === "image/jpg" ? "image/jpeg" : mime);

      let result: DetectResult;
      try {
        result = await extractFromAI(base64, detectedMime);
      } catch (err: any) {
        const msg = String(err?.message ?? "").toLowerCase();
        if (msg.includes("password") || msg.includes("encrypt")) {
          return NextResponse.json({
            error: "Ce relevé est protégé par un mot de passe. Téléchargez une version sans protection depuis votre application bancaire.",
          }, { status: 422 });
        }
        if (msg.includes("too large") || msg.includes("size")) {
          return NextResponse.json({
            error: "Impossible de lire ce relevé automatiquement. Essayez d'uploader une version meilleure qualité ou importez en CSV.",
          }, { status: 422 });
        }
        return NextResponse.json({
          error: "Impossible de lire ce relevé automatiquement. Essayez d'uploader une version meilleure qualité ou importez votre relevé en CSV depuis votre espace bancaire en ligne.",
        }, { status: 422 });
      }

      if (result.lines.length === 0) {
        return NextResponse.json({
          error: "Aucune transaction détectée. Vérifiez que le document est bien un relevé bancaire ou importez en CSV.",
        }, { status: 422 });
      }

      return NextResponse.json({ ...result, file_name: file.name });
    }

    // ── CSV ───────────────────────────────────────────────────────────────────
    if (isCSV) {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) {
        return NextResponse.json({ error: "CSV vide ou format invalide" }, { status: 400 });
      }

      const lines: DetectedLine[] = [];
      let skipped = 0;
      for (const row of rows) {
        const mapped = mapCSVRow(row);
        if (!mapped.date || mapped.amount === 0) { skipped++; continue; }
        lines.push({
          date: mapped.date,
          description: mapped.description || "Transaction",
          reference: mapped.reference || null,
          amount: mapped.amount,
          balance_after: mapped.balance_after || null,
        });
      }

      const warnings: string[] = [];
      if (skipped > 0) warnings.push(`${skipped} ligne${skipped > 1 ? "s" : ""} ignorée${skipped > 1 ? "s" : ""} (date ou montant manquant).`);
      if (!lines.length) return NextResponse.json({ error: "Aucune ligne valide dans le CSV" }, { status: 400 });

      return NextResponse.json({
        bank_name: null, account_number: null,
        period_start: null, period_end: null, period_label: null,
        opening_balance: null, closing_balance: null,
        lines, warnings, file_name: file.name,
      });
    }

    // ── Excel ─────────────────────────────────────────────────────────────────
    if (isXLSX) {
      const XLSX = await import("xlsx");
      const bytes = await file.arrayBuffer();
      const wb = XLSX.read(Buffer.from(bytes), { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      // Normalise keys to lowercase
      const rows: Record<string, string>[] = raw.map(r =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [String(k).toLowerCase().trim(), String(v)]))
      );

      const lines: DetectedLine[] = [];
      let skipped = 0;
      for (const row of rows) {
        const mapped = mapCSVRow(row);
        if (!mapped.date || mapped.amount === 0) { skipped++; continue; }
        lines.push({
          date: mapped.date,
          description: mapped.description || "Transaction",
          reference: mapped.reference || null,
          amount: mapped.amount,
          balance_after: mapped.balance_after || null,
        });
      }

      const warnings: string[] = [];
      if (skipped > 0) warnings.push(`${skipped} ligne${skipped > 1 ? "s" : ""} ignorée${skipped > 1 ? "s" : ""} (date ou montant manquant).`);
      if (!lines.length) return NextResponse.json({ error: "Aucune ligne valide dans le fichier Excel" }, { status: 400 });

      return NextResponse.json({
        bank_name: null, account_number: null,
        period_start: null, period_end: null, period_label: null,
        opening_balance: null, closing_balance: null,
        lines, warnings, file_name: file.name,
      });
    }

    return NextResponse.json({
      error: "Format non supporté. Utilisez PDF, CSV, Excel (.xlsx) ou une image.",
    }, { status: 400 });

  } catch (err: any) {
    console.error("[rapprochement/detect]", err);
    return NextResponse.json({ error: err.message ?? "Erreur serveur" }, { status: 500 });
  }
}
